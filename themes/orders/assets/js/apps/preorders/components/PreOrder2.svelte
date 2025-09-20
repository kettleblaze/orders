<script lang="js">
  import { onMount } from "svelte";
  import SirvImage from "./SirvImage.svelte";
  import { translate as T, getPreferredLanguage } from "../i18n/utils.js";
  import ShareBlazeBanner from "./ShareBlazeBanner.svelte";

  const SHAREBLAZE_SKUS = [
    "prod_N1V8kEQDCAc5SY",
    "prod_D1V8kEQDCAc5SY",
    "prod_D2V8kEQDCAc5SY",
  ];

  export let uploadUrl = "/account/orders/{id}/shareblaze";
  // --- inizio modifica per cookie-based admin access ---
  const ADMIN_TOKEN = "kettleblazeadmin01"; // <— sostituisci con la stringa desiderata

  function getCookie(name) {
    const match = document.cookie.match("(^|;)\\s*" + name + "=([^;]+)");
    return match ? decodeURIComponent(match.pop()) : "";
  }

  let isLocal = false;
  // --- fine modifica ---

  let isUpdating = false;
  let order = null;
  let errorOrNotFound = false;
  let event = {};
  let orderStatus = "";
  let tracking = {
    courier: "",
    packages: 1,
    tracking_links: [],
    shipment_id: -1,
    delivered: false,
  };
  let newTrackingLink = "";
  let editingIndex;
  let editedEvent = { status: "", message: "" };
  const statusOptions = [
    "order_placed",
    "refunded",
    "in_preparation",
    "ready_to_ship",
    "shipped",
    "delivered",
    "canceled",
  ];
  // --- Estensione: messaggi precompilati per eventi ---
  const MESSAGE_TEMPLATES_BY_LANG = {
    it: [
      "Il tuo ordine è in preparazione.",
      "Il tuo ordine è pronto per essere spedito.",
      "Il tuo ordine è stato spedito.",
    ],
    en: [
      "Your order is being prepared.",
      "Your order is ready to ship.",
      "Your order has been shipped.",
    ],
    de: [
      "Ihre Bestellung wird vorbereitet.",
      "Ihre Bestellung ist versandfertig.",
      "Ihre Bestellung wurde versandt.",
    ],
    fr: [
      "Votre commande est en préparation.",
      "Votre commande est prête à être expédiée.",
      "Votre commande a été expédiée.",
    ],
    es: [
      "Tu pedido está en preparación.",
      "Tu pedido está listo para enviar.",
      "Tu pedido ha sido enviado.",
    ],
    pl: [
      "Twoje zamówienie jest przygotowywane.",
      "Twoje zamówienie jest gotowe do wysyłki.",
      "Twoje zamówienie zostało wysłane.",
    ],
  };
  let precompiledMessages =
    MESSAGE_TEMPLATES_BY_LANG[getPreferredLanguage()] ||
    MESSAGE_TEMPLATES_BY_LANG.it;
  // --- Fine estensione ---

  const courierOptions = [
    "BRT",
    "DPD",
    "UPS",
    "FedEx",
    "PosteItaliane",
    "InPost",
  ];

  function updateTrackingLink(url, nuovoTracking) {
    return url
      .replace("loc=it_IT", "loc=en_GB")
      .replace(/tracknum=[^&]+/, `tracknum=${nuovoTracking}`);
  }

  async function setupTracking() {
    const infoSped = await fetch(
      `process.env.storeServer/info-spedizione/${tracking.shipment_id}`
    ).then((res) => res.json());

    tracking.courier = infoSped.corriere;

    let links = [];
    for (let collo of infoSped.colli) {
      let link = updateTrackingLink(infoSped.trackLink, collo.tracking);
      links.push(link);
    }
    tracking.packages = links.length;
    tracking.tracking_links = links;
  }

  async function sendTrackingNotificaton() {
    const response = await fetch(
      `process.env.storeServer/send-tracking-email/${order.orderId}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (response.ok) {
      alert("Email inviata con successo!");
    } else {
      alert("Errore nell'invio dell'email.");
    }
  }

  async function sendNotificationEmail(eventId, type = "event") {
    if (!order) return;

    const emailPayload = {
      orderId: order.orderId,
      historyIndex: eventId,
      type: type,
    };

    try {
      const response = await fetch(
        `process.env.storeServer/send-notification`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(emailPayload),
        }
      );

      if (response.ok) {
        alert("Email inviata con successo!");
      } else {
        alert("Errore nell'invio dell'email.");
      }
    } catch (error) {
      console.error("Errore nell'invio dell'email:", error);
      alert("Errore imprevisto. Riprova.");
    }
  }

  function formatCurrency(price, currency) {
    return new Intl.NumberFormat("en-IT", {
      style: "currency",
      currency: currency || "EUR",
      maximumFractionDigits: 2,
    }).format(price / 100);
  }

  function updateOrderStatus() {
    isUpdating = true;
    order.status = orderStatus;
    updateOrder().then(() => setTimeout(() => (isUpdating = false), 1000));
  }

  async function getOrder() {
    const params = new URLSearchParams(window.location.search);
    const lang = getPreferredLanguage();
    const o = await fetch(
      `process.env.storeServer/orders/${params.get("id")}/${lang}`,
      {
        method: "GET",
      }
    ).then((r) => (r.ok ? r.json() : null));

    if (!o) {
      errorOrNotFound = true;
    } else {
      orderStatus = o.status;
    }

    if (o && o.cart && o.cart.items) {
      // ordiniamo per prezzo finale decrescente
      o.cart.items.sort((a, b) => b.final_price - a.final_price);
    }

    order = o;
  }

  async function updateOrder() {
    if (!order) return;
    await fetch(`process.env.storeServer/order2/${order.orderId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order),
    });
  }

  function addHistoryEvent() {
    if (event.status && event.message) {
      const newEvent = {
        timestamp: new Date(),
        status: event.status,
        message: event.message,
      };

      order.history.push(newEvent);
      order = order;
      updateOrder();
      event = { status: "", message: "" };
    }
  }

  function editHistoryEvent(index) {
    editingIndex = index;
    editedEvent = { ...order.history[index] };
  }

  function saveHistoryEvent(index) {
    order.history[index] = editedEvent;
    updateOrder().then(() => sendNotificationEmail(editedEvent));
    editingIndex = null;
  }

  function addTrackingLink() {
    if (newTrackingLink) {
      tracking.tracking_links.push(newTrackingLink);
      tracking = tracking;
      newTrackingLink = "";
    }
  }

  function updateTracking() {
    if (!order) return;
    order.tracking = { ...tracking };
    updateOrder(); //.then(() => sendNotificationEmail(order.orderId, "tracking"));
  }

  function calculateTotal(order) {
    let sum = order.cart.items.reduce(
      (acc, item) => acc + 100 * item.final_price * item.quantity,
      0
    );
    return formatCurrency(sum, order.payment.currency);
  }

  async function getReceiptUrl() {
    if (!order || !order.payment || !order.payment.stripe_payment_intent) {
      return { url: "N/A" };
    }
    const response = await fetch(
      `process.env.storeServer/receipt-url/${order.payment.stripe_payment_intent}`,
      { method: "GET", headers: { "Content-Type": "application/json" } }
    );
    if (response.ok) {
      const data = await response.json();
      return { url: data.url };
    } else {
      return { url: "N/A" };
    }
  }

  // handler per l’evento submit dal figlio
  function handleShareBlazeSubmit(e) {
    const data = e.detail; // { orderId, platform, handle, link, file, reward, lang, hashtag, ts }

    // TODO: invia a tua API (es. /api/shareblaze/upload)
    // - se data.file presente, usa FormData e multipart
    // - altrimenti invia JSON con link
    // fetch(...)

    // Mostra notifica/aggiorna stato a schermo
    console.log("ShareBlaze payload", data);
  }

  // opzionale: mostrare regole in una modal o ancorare alla sezione FAQ
  function openRules() {
    // scroll/ancora/modal
    const rules = document.getElementById("shareblaze-rules");
    if (rules) rules.scrollIntoView({ behavior: "smooth" });
  }

  onMount(() => {
    // Determina admin access via cookie
    isLocal = getCookie("kbadmin341") === ADMIN_TOKEN;
    getOrder();
  });
</script>

{#if !order}
  {#if errorOrNotFound}
    <h1 class="title">Order not found</h1>
  {:else}
    <div class="sloader-container">
      <span class="sloader"></span>
      <h3 class="is-size-5">Please wait</h3>
    </div>
  {/if}
{:else}
  <div class="columns">
    <div class="column is-half">
      <!--
      {#if order.cart.items.find((product) => SHAREBLAZE_SKUS.includes(product.sku))}
        <ShareBlazeBanner
          lang={getPreferredLanguage()}
          orderId={order.orderId}
          {uploadUrl}
          products={["Flexibell 2", "Magneti-X"]}
          isEligible={true}
          on:submit={handleShareBlazeSubmit}
          on:rules={openRules}
        />
      {/if}
    -->
      <h2 class="title mt-6 px-5">{T("order-summary")}</h2>
      <div class="box">
        <ul>
          {#each order.cart.items as item}
            <li>
              <div class="columns is-align-items-center">
                <div class="column">
                  <SirvImage
                    src="https://kettleblaze.sirv.com/orders/{item.sku}.jpg"
                    width="480"
                    height="480"
                    displayWidth="120"
                    displayHeight="120"
                    quality="98"
                  ></SirvImage>
                  <div class="column">
                    <h4 class="title has-text-info is-size-4">
                      {item.quantity} x {item.name.it}
                    </h4>
                    {#if Object.keys(item.selected_attributes ?? {}).length > 0}
                      <ul>
                        {#each Object.entries(item.selected_attributes) as [name, value]}
                          <li>
                            {T(name)}: {name === "size"
                              ? value
                              : T(value) || value}
                          </li>
                        {/each}
                      </ul>
                    {/if}
                    <p class="is-size-5">
                      {formatCurrency(item.final_price * 100, item.currency)}
                    </p>
                  </div>
                </div>
              </div>
            </li>
          {/each}
          <li>
            <hr class="spacer" />
            <div class="column">
              <h4 class="title has-text-info is-size-4 mt-5">
                {T("order-total")}
              </h4>
              <p class="my-3 is-size-5">{calculateTotal(order)}</p>
            </div>
          </li>
        </ul>
      </div>
    </div>
    <div class="column px-6">
      <h2 class="title mt-6">{T("order-details")}</h2>
      <ul>
        <li>Id: {order.orderId}</li>
        {#if order.payment.method}
          <li>
            {T("payment-method")}: {order.payment.method}
          </li>
        {/if}
        <li>
          {T("payment-status")}:
          <span class="has-text-info has-text-weight-bold"
            >{order.payment.status}</span
          >
        </li>
        <li>
          {#if order.payment.status === "paid"}
            <div class="field">
              {#await getReceiptUrl() then response}
                <a class="has-text-info" target="_blank" href={response.url}
                  >🔗 {T("receipt")}</a
                >{/await}
            </div>
          {/if}
        </li>
      </ul>
      {#if isLocal}
        <form class="form mt-5">
          <div class="columns">
            <div class="column">
              <div class="select is-info">
                <select
                  name="order-status"
                  id="order-status"
                  bind:value={orderStatus}
                  disabled={isUpdating ? "disabled" : ""}
                >
                  <option value="paid" selected={orderStatus === "paid"}
                    >{T("paid")}</option
                  >
                  <option value="ready" selected={orderStatus === "ready"}
                    >{T("ready")}</option
                  >
                  <option
                    value="in-preparation"
                    selected={orderStatus === "in-preparation"}
                    >{T("in-preparation")}</option
                  >
                  <option
                    value="waiting-product"
                    selected={orderStatus === "waiting-product"}
                    >{T("waiting-product")}</option
                  >
                  <option
                    value="to-be-shipped"
                    selected={orderStatus === "to-be-shipped"}
                    >{T("to-be-shipped")}</option
                  >
                  <option value="shipped" selected={orderStatus === "shipped"}
                    >{T("shipped")}</option
                  >
                  <option value="refunded" selected={orderStatus === "refunded"}
                    >{T("refunded")}</option
                  >
                  <option
                    value="delivered"
                    selected={orderStatus === "delivered"}
                    >{T("delivered")}</option
                  >
                </select>
              </div>
            </div>

            <div class="column">
              <button
                type="button"
                class="button is-info has-text-white"
                on:click={updateOrderStatus}>{T("update")}</button
              >
            </div>
          </div>
        </form>
      {:else}
        <h2 class="title mt-6">{T("order-status")}</h2>
        <h2 class="title has-text-info has-text-weight-bold">
          {T(order.status)}
        </h2>
      {/if}
      <h2 class="title mt-6">{T("customer-details")}</h2>
      <ul>
        <li>{T("name")}: {order.customerData.name}</li>
        {#if order.customerData.fiscal_code}
          <li>Codice fiscale: {order.customerData.fiscal_code}</li>
        {/if}
        <li>{T("phone")}:{order.customerData.phone}</li>
        <li>Email: {order.customerData.email}</li>
      </ul>
      <h2 class="title mt-6">{T("shipping-address")}</h2>
      <ul>
        <li>{order.customerData.name}</li>
        <li>{order.customerData.address.line1}</li>
        <li>{order.customerData.address.line2}</li>
        <li>
          {order.customerData.address.city}, {order.customerData.address
            .postal_code}{#if order.customerData.address.state}({order
              .customerData.address.state}){/if}
        </li>
        <li>{order.customerData.address.country}</li>
      </ul>

      <h2 class="title mt-5">{T("order-history")}</h2>
      <ul>
        {#each order.history as historyEvent, index}
          <li class="mb-2 py-3">
            <span class="has-text-grey is-size-6">
              {new Date(historyEvent.timestamp).toLocaleString("it-IT", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
            <br />

            {#if editingIndex === index}
              <div class="select">
                <select bind:value={editedEvent.status}>
                  {#each statusOptions as status}
                    <option value={status}>{T(status)}</option>
                  {/each}
                </select>
              </div>
              <input
                class="input mt-2"
                type="text"
                bind:value={editedEvent.message}
              />
              <div class="select mt-2">
                <select
                  on:change={(e) => {
                    if (e.target.value) editedEvent.message = e.target.value;
                    e.target.value = "";
                  }}
                >
                  <option value=""
                    >{T("select") || "Seleziona messaggio precompilato"}</option
                  >
                  {#each precompiledMessages as msg}
                    <option value={msg}>{msg}</option>
                  {/each}
                </select>
              </div>
              <button
                class="button is-success mt-2"
                on:click={() => saveHistoryEvent(index)}
              >
                {T("save")}
              </button>
            {:else}
              <strong class="has-text-info">{T(historyEvent.status)}</strong>
              <p class="mt-2">{historyEvent.message}</p>

              {#if isLocal}
                <button
                  class="button is-warning mt-3"
                  on:click={() => editHistoryEvent(index)}
                >
                  {T("edit")}
                </button>

                <!-- Pulsante per inviare la mail manualmente -->
                <button
                  class="button is-info mt-3 ml-3"
                  on:click={() => sendNotificationEmail(index)}
                >
                  📧 {T("send-notification")}
                </button>
              {/if}
            {/if}
          </li>
        {/each}
      </ul>
      {#if order.tracking.length > 0}
        <h2 class="title mt-6">{T("tracking_details")}</h2>
        {#each order.tracking as tracking}
          <div class="field">
            <label class="label">{T("courier")}</label>
            <p class="is-size-5">{tracking.courier}</p>
          </div>
          <div class="field">
            <label class="label">{T("number_of_packages")}:</label>
            <p>{tracking.packages}</p>
          </div>

          <div class="field">
            <label class="label">{T("tracking_links")}</label>
            <ul>
              {#each tracking.tracking_links as link, index}
                <li>
                  <a href={link} target="_blank">{link}</a>
                </li>
              {/each}
            </ul>
          </div>
          {#if isLocal}
            <button
              class="button is-info mt-3 has-text-white"
              on:click={sendTrackingNotificaton}>Invia mail di tracking</button
            >
          {/if}
        {/each}
      {/if}
      {#if isLocal}
        <div class="field my-6">
          <label class="label">{T("add-event")}</label>
          <div class="select">
            <select bind:value={event.status}>
              <option value="" disabled selected>{T("select-status")}</option>
              {#each statusOptions as status}
                <option value={status}>{T(status)}</option>
              {/each}
            </select>
          </div>
          <input
            class="input mt-2"
            type="text"
            placeholder={T("message")}
            bind:value={event.message}
          />
          <div class="select mt-2">
            <select
              on:change={(e) => {
                if (e.target.value) event.message = e.target.value;
                e.target.value = "";
              }}
            >
              <option value=""
                >{T("select") || "Seleziona messaggio precompilato"}</option
              >
              {#each precompiledMessages as msg}
                <option value={msg}>{msg}</option>
              {/each}
            </select>
          </div>
          <button class="button is-info mt-2" on:click={addHistoryEvent}
            >{T("add")}</button
          >
        </div>

        <div class="tracking-section">
          <h2 class="title">Tracking</h2>
          <div class="field">
            <label class="label">Corriere</label>
            <div class="select">
              <select bind:value={tracking.courier}>
                {#each courierOptions as courier}
                  <option value={courier}>{courier}</option>
                {/each}
              </select>
            </div>
          </div>
          <div class="field">
            <label class="label">Id spedizione</label>
            <input
              class="input"
              type="number"
              min="1"
              on:change={setupTracking}
              bind:value={tracking.shipment_id}
            />
          </div>
          <div class="field">
            <label class="label">Numero colli</label>
            <input
              class="input"
              type="number"
              min="1"
              bind:value={tracking.packages}
            />
          </div>
          <div class="field">
            <label class="label">Link di tracking</label>
            <ul>
              {#each tracking.tracking_links as link, index}
                <li>
                  <a href={link} target="_blank">{link}</a>
                  <button
                    class="button is-small is-danger ml-2"
                    on:click={() => tracking.tracking_links.splice(index, 1)}
                  >
                    {T("remove")}
                  </button>
                </li>
              {/each}
            </ul>
            <input
              class="input mt-2"
              type="text"
              placeholder={T("add-tracking-link")}
              bind:value={newTrackingLink}
            />
            <button class="button is-info mt-2" on:click={addTrackingLink}
              >{T("add")}</button
            >
          </div>
          <button class="button is-success mt-4" on:click={updateTracking}
            >Salva Tracking</button
          >
        </div>
      {/if}
    </div>
  </div>
{/if}
