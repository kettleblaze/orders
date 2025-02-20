<script lang="js">
  import { onMount } from "svelte";
  import SirvImage from "./SirvImage.svelte";
  import { translate as T, getPreferredLanguage } from "../i18n/utils.js";

  let isUpdating = false;
  let order = null;
  let errorOrNotFound = false;
  let event = {};
  let orderStatus = "";
  let tracking = { courier: "", packages: 1, tracking_links: [] };
  let newTrackingLink = "";
  let editingIndex;
  let editedEvent = { status: "", message: "" };
  const statusOptions = [
    "order_placed",
    "in_preparation",
    "ready_to_ship",
    "shipped",
    "delivered",
    "canceled",
  ];
  const courierOptions = ["BRT", "DPD", "UPS", "FedEx", "PosteItaliane"];

  async function sendNotificationEmail(eventId, type = "event") {
    if (!order) return;

    const emailPayload = {
      orderId: order.orderId,
      eventId: eventId,
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
      updateOrder().then(() => sendNotificationEmail(newEvent));
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
   // order.tracking = { ...tracking };
    updateOrder().then(() => sendNotificationEmail(order.orderId, "tracking"));
  }

  function calculateTotal(order) {
    let sum = order.cart.items.reduce(
      (acc, item) => acc + 100 * item.final_price * item.quantity,
      0
    );
    return formatCurrency(sum, order.payment.currency);
  }

  onMount(() => {
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
                    <h4 class="title has-text-info iss-size-4">
                      {item.quantity} x {item.name.it}
                    </h4>
                    {#if Object.keys(item.selected_attributes).length > 0}
                      <ul>
                        {#each Object.entries(item.selected_attributes) as [name, value]}
                          <li>
                            {T(name)}: {name === "size"
                              ? value.toUpperCase()
                              : T(value)}
                          </li>
                        {/each}
                      </ul>
                    {/if}
                    <p class="is-size-6">
                      {formatCurrency(item.final_price * 100, item.currency)}
                    </p>
                  </div>
                </div>
              </div>
            </li>
          {/each}
        </ul>
        <h4 class="title has-text-info is-size-4 mt-5">{T("order-total")}</h4>
        <p class="my-3">{calculateTotal(order)}</p>
      </div>
    </div>
    <div class="column px-6">
      <h2 class="title">{T("order-details")}</h2>
      <ul>
        <li>Id: {order.orderId}</li>
        <li>
          {T("payment-method")}: {order.payment.status}
        </li>
        <li>
          {T("payment-status")}:
          <span class="has-text-info has-text-weight-bold"
            >{order.payment.status}</span
          >
        </li>
      </ul>
      {#if process.env.isLocal}
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
        <li>Email: {order.customerData.email}</li>
      </ul>
      <h2 class="title mt-6">{T("shipping-address")}</h2>
      <ul>
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
        {#each order.history as historyEvent, index (historyEvent._id)}
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
              <button
                class="button is-success mt-2"
                on:click={() => saveHistoryEvent(index)}
              >
                {T("save")}
              </button>
            {:else}
              <strong class="has-text-info">{T(historyEvent.status)}</strong>
              <p class="mt-2">{historyEvent.message}</p>

              {#if process.env.isLocal}
                <button
                  class="button is-warning mt-3"
                  on:click={() => editHistoryEvent(index)}
                >
                  {T("edit")}
                </button>

                <!-- Pulsante per inviare la mail manualmente -->
                <button
                  class="button is-info mt-3 ml-3"
                  on:click={() => sendNotificationEmail(historyEvent._id)}
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
          {#if process.env.isLocal}
            <button
              class="button is-info mt-3 has-text-white"
              on:click={updateTracking}>Invia mail di tracking</button
            >
          {/if}
        {/each}
      {/if}
      {#if process.env.isLocal}
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
