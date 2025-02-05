<script lang="js">
  import { onMount } from "svelte";
  import SirvImage from "./SirvImage.svelte";
  import { translate as T, getPreferredLanguage } from "../i18n/utils.js";
  let internationalPrefix = $state(""),
    phoneNumber = $state("");

  let isUpdating = $state(false);
  let order = $state(null);
  let errorOrNotFound = $state(false);
  let event = $state({});
  let orderStatus = $state({});

  let openEditors = $state({});
  let editors = $state({});

  let tracking = $state({ courier: "ups", parcels: [] });

  function ucfirst(str) {
    if (typeof str === "String") {
      return str[0].toUpperCase() + str.substring(1, str.length);
    }
    return str;
  }

  const trackingLinks = {
    ups: "https://www.ups.com/track?loc=en_GB&tracknum=PARCELNUM&requester=WT/trackdetails",
  };

  function formatCurrency(product) {
    return new Intl.NumberFormat("en-IT", {
      style: "currency",
      currency: product.currency || "EUR",
      maximumFractionDigits: 2,
    }).format((product.price || product.amount_total) / 100);
  }

  function addEvent() {
    if (event.type === "tracking-info") {
      let parcels = tracking.parcels.filter((v) => v.length > 0);

      let tpl = `Informazioni di tracking<br>Corriere: ${tracking.courier.toUpperCase()}<br> Pacchi: ${parcels.length}<br><ul style="list-style-type:none;margin:10px auto;">${parcels
        .map((parcel, index) => {
          let pattern = /(?:tracknum=)(\w+)&/gim;
          if (tracking.courier === "brt") {
            pattern = /(?:chisono=)(\d*)/;
          }
          let matches = pattern.exec(parcel);

          return `<li><a href="${parcel}" target="_blank">Pacco ${index + 1}: ${matches[1]} </a></li>`;
        })
        .join("")}</ul>`;
      event.text = tpl;
    }
    if (event.text && event.text.length > 0) {
      order.events.push({
        ts: Date.now(),
        level: event.level,
        type: event.type,
        data: { text: event.text },
      });
      order = order;
      updateOrder();
    }
  }

  function switchEditor(index) {
    if (openEditors[index] !== true) {
      openEditors[index] = true;
      editors[index].value = order.events[index].data.text;
    } else {
      order.events[index].data.text = editors[index].value;
      openEditors[index] = false;
      updateOrder();
    }
  }

  async function updateOrder() {
    fetch(`process.env.storeServer/order/${order.id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(order),
    }).then((r) => {
      if (r.ok) {
        event.level = "info";
        event.type = "update";
        event.text = null;
      }
    });
  }

  function displayPaymentMethod(pm) {
    let type = "",
      wallet = "";
    if (pm.type === "paypal") {
      return "PayPal";
    }
    if (pm.type === "card") {
      type = pm.card;
    }
    if (pm.type === "customer_balance") {
      type = T("customer_balance");
    }
    if (pm.wallet) {
      let v = "";
      switch (pm.wallet) {
        case "google_pay":
          v = "Google Pay";
          break;
      }
      wallet = v;
    }
    return (wallet ? `(${wallet}) ` : "") + type;
  }

  function displayOrderStatus(status) {
    return T(status);
  }

  function updateOrderStatus() {
    isUpdating = true;
    order.status = orderStatus;
    updateOrder().then(() => setTimeout(() => (isUpdating = false), 1000));
  }

  function calculateTotal(order) {
    let sum = 0;
    for (let product of order.products) {
      if (product.price) {
        sum = sum + product.quantity * product.price;
      }
    }
    if (order.shippingCost) {
      sum = sum + order.shippingCost.amount_total;
    }

    return formatCurrency({
      price: sum,
      currency: order.shippingCost?.currency || "EUR",
    });
  }

  function timeZoneDifferenceToGMT(d) {
    let offset = d.getTimezoneOffset();
    console.log(d.toString());
    return `GMT${offset < 0 ? "+" : "-"}${(offset / 60) * -1}`;
  }

  async function sendUpdateEmail(stripeSessionId, eventIndex) {
    if (confirm("Vuoi inviare la mail di aggiornamento?")) {
      const lang = getPreferredLanguage();
      const o = await fetch(
        `process.env.storeServer/send-update-email/${stripeSessionId}/${eventIndex}/`,
        { method: "GET" }
      ).then((r) => {
        if (r.ok) {
          alert("Email inviata");
        } else {
          alert("Errore invio email");
        }
      });
    }
  }

  async function getOrder() {
    const params = new URLSearchParams(window.location.search);
    const lang = getPreferredLanguage();
    // `https://kettleblaze-store-server.fly.dev/order/${params.get("id")}/${lang}`
    // `http://localhost:8080/order/${params.get("id")}/${lang}`,
    const o = await fetch(
      `process.env.storeServer/order/${params.get("id")}/${lang}`,
      { method: "GET" }
    )
      .then((r) => {
        if (r.ok) {
          errorOrNotFound = false;
          return r.json();
        } else {
          errorOrNotFound = true;
          return {};
        }
      })
      .then((o) => {
        internationalPrefix = "+" + o.customer.address.country_data.phone[0];
        orderStatus = o.status;
        return o;
      });
    //  order.customer = o.customer;
    return o;
  }

  async function updatePhoneNumber() {
    if (internationalPrefix.length > 0 && phoneNumber.length > 0) {
      isUpdating = true;
      fetch(
        `https://kettleblaze-store-server.fly.dev/order/phone/${order.id}/${internationalPrefix}/${phoneNumber}`
      )
        .catch((e) => {
          return { status: e.message };
        })
        .then((r) => {
          if (r.ok) {
            return r.json();
          } else {
            isUpdating = false;
            return { status: "Error" };
          }
        })
        .then((r) => {
          if (r.status === "ok") {
            order.customer.phone = phoneNumber;
            isUpdating = false;
          }
        });
    } else return false;
  }
  onMount(() => {
    getOrder().then((o) => (order = o));
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
{:else if order}
  <div class="columns">
    <div class="column is-half">
      <h2 class="title mt-6 px-5">{T("order-summary")}</h2>
      <div class="box">
        {#if order.products.length > 0}
          <ul>
            {#each order.products as product}
              <li>
                <div class="columns is-align-items-center">
                  <div class="column">
                    {#if product.sku !== "prod_AI839Kll1kzw23"}
                      <SirvImage
                        src="https://cdn.kettleblaze.store/orders/{product.sku}.jpg"
                        width="480"
                        height="480"
                        displayWidth="120"
                        displayHeight="120"
                        quality="98"
                      ></SirvImage>
                    {/if}
                    <div class="column">
                      <h4 class="title has-text-info is-size-4">
                        {product.quantity} x {product.name}
                      </h4>
                      <p class="is-size-6">{product.description}</p>
                      {#if product.price > 0}
                        <p class="is-size-5 my-3">
                          {formatCurrency(product)}
                        </p>
                      {/if}
                      {#if product.extras.length > 0}
                        <ul class="mt-3">
                          {#each product.extras as extra}
                            <li>
                              {T(extra.name)}: {ucfirst(extra.value)}
                            </li>
                          {/each}
                        </ul>
                      {/if}
                    </div>
                  </div>
                </div>
              </li>
            {/each}
            {#if order.shippingCost}
              <li>
                <div class="column">
                  <h4 class="title has-text-info is-size-4 mb-2">
                    {T("shipping-cost")}
                  </h4>
                  {#if order.shippingCost.display_name}
                    <div
                      class="is-flex is-align-items-center is-justify-content-flex-start mt-3"
                    >
                      <span class="icon pr-3"
                        ><i class="material-symbols-outlined">
                          delivery_truck_speed
                        </i></span
                      >
                      <p class="is-size-6">
                        {order.shippingCost.display_name}
                      </p>
                    </div>
                  {/if}

                  <p class="is-size-5">
                    {formatCurrency(order.shippingCost)}
                  </p>
                </div>
              </li>
            {/if}
            <li>
              <div class="column">
                <hr />
                <h4 class="title has-text-info is-size-4 mt-5">
                  {T("order-total")}
                </h4>
                <p class="my-3">
                  {calculateTotal(order)}
                </p>
              </div>
            </li>
          </ul>
        {/if}
      </div>
    </div>
    <div class="column px-6">
      <div class="mt-6">
        <h2 class="title">{T("order-details")}</h2>
        <ul>
          <li>Id: {order.kettleblazeId}</li>
          <li>
            {T("payment-method")}: {displayPaymentMethod(order.paymentMethod)}
          </li>
          {#if order.paymentMethod.subscription}
            <li class="pt-5">
              {T("payment-type")}: {T("three-installments")}
            </li>
            <li>
              {T("start-date")}: {new Date(
                order.paymentMethod.subscription.start_date
              ).toLocaleDateString()}
            </li>
            <li>
              {T("end-date")}: {new Date(
                order.paymentMethod.subscription.cancel_at
              ).toLocaleDateString()}
            </li>
            <li>
              {T("installment-amount")}: {formatCurrency({
                amount_total: order.paymentMethod.subscription.plan.amount,
                currency: order.paymentMethod.subscription.plan.currency,
              })}
            </li>
          {:else}
            <li>
              {T("payment-status")}:
              <span class="has-text-info has-text-weight-bold">paid</span>
            </li>
          {/if}
        </ul>
        <h2 class="title mt-6">{T("order-status")}</h2>
        {#if process.env.isLocal}
          <form class="form">
            <div class="columns">
              <div class="column">
                <div class="select is-info">
                  <select
                    name="order-status"
                    id="order-status"
                    bind:value={orderStatus}
                    disabled={isUpdating ? "disabled" : ""}
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
          <h2 class="title has-text-info has-text-weight-bold">
            {displayOrderStatus(order.status)}
          </h2>
        {/if}
        <h2 class="title mt-6">{T("customer-details")}</h2>
        <ul>
          <li>{T("name")}: {order.customer.name}</li>
          <li>
            {#if order.customer.phone}
              {T("phone")}: +{order.customer.address.country_data.phone[0]}
              {order.customer.phone}
            {:else}
              <form class="form my-4">
                <div class="columns is-mobile is-1">
                  <div class="column is-one-quarter">
                    <input
                      class="input is-info"
                      type="text"
                      placeholder="International prefix"
                      bind:value={internationalPrefix}
                    />
                  </div>
                  <div class="column is-two-thirds">
                    <input
                      class="input is-info"
                      type="text"
                      bind:value={phoneNumber}
                      placeholder={T("mob-phone")}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  class="button is-info has-text-white"
                  disabled={isUpdating}
                  on:click={updatePhoneNumber}>{T("update")}</button
                >
              </form>
            {/if}
          </li>
          <li>Email: {order.customer.email}</li>
        </ul>
        <h2 class="title mt-6">{T("shipping-address")}</h2>
        {#if order.customer.shipping_details}
          <ul>
            <li>{order.customer.shipping_details.name}</li>
            <li>{order.customer.shipping_details.address.line1}</li>
            <li>{order.customer.shipping_details.address.line2}</li>
            <li>
              {order.customer.shipping_details.address.postal_code}
              {order.customer.shipping_details.address.city}
              {order.customer.shipping_details.address.state
                ? `(${order.customer.shipping_details.address.state})`
                : ""}
            </li>
            <li>
              {order.customer.address.country_data.native} - {order.customer
                .address.country}
            </li>
          </ul>
        {:else if order.customer.address}
          <ul>
            <li>{order.customer.address.line1}</li>
            <li>{order.customer.address.line2}</li>
            <li>
              {order.customer.address.postal_code}
              {order.customer.address.city}
              {order.customer.address.state
                ? `(${order.customer.address.state})`
                : ""}
            </li>
            <li>
              {order.customer.address.country_data.native} - {order.customer
                .address.country}
            </li>
          </ul>
        {/if}
      </div>
      <div id="history" class="my-6">
        <h2 class="title pt-2">{T("history")}</h2>
        {#each order.events as event, index}
          <div
            class="mt-5"
            class:is-tracking={event.type === "tracking-info"}
            class:pt-4={event.type === "tracking-info"}
          >
            {#if event.type === "tracking-info"}
              <h3 class="has-text-info title is-size-3">Tracking</h3>
            {/if}
            <div>
              <span class="has-text-{event.level}"
                >• {new Date(event.ts).toLocaleDateString()}
                {new Date(event.ts).toLocaleTimeString()}
              </span>
            </div>
            {#if event.data}
              <div class:has-text-warning={event.level === "warning"}>
                <div class="px-3">
                  <span
                    id={`event-${index}`}
                    class:is-hidden={openEditors[index] === true}
                    >{@html event.data.text}</span
                  >
                  <textarea
                    class="textarea"
                    class:is-hidden={openEditors[index] !== true}
                    bind:this={editors[index]}
                    name="editor-{index}"
                    id="edit-event-{index}"
                  ></textarea>
                </div>
              </div>

              {#if process.env.isLocal}
                <hr />

                <div class="pb-6">
                  <span
                    class="tag is-large"
                    class:is-info={event.emailSent}
                    class:has-text-white={event.emailSent}
                    >Email {#if event.emailSent}inviata{:else}NON inviata{/if}</span
                  >

                  <button
                    type="button"
                    class="button"
                    on:click={() =>
                      sendUpdateEmail(order.stripeSessionId, index)}
                  >
                    <span class="icon p-3"
                      ><i class="material-symbols-outlined"> send </i></span
                    >
                  </button>
                  <button
                    type="button"
                    class="button"
                    on:click={() => switchEditor(index)}
                  >
                    <span class="icon p-3"
                      ><i class="material-symbols-outlined">
                        {#if !openEditors[index]}edit{:else}close{/if}
                      </i></span
                    >
                  </button>
                </div>
              {/if}
            {/if}
          </div>
        {/each}
      </div>
      {#if process.env.isLocal}
        <form class="form">
          <label class="label" for="">Level</label>
          <div class="select is-info mb-4">
            <select bind:value={event.level}>
              <option value="info">info</option>
              <option value="warning">warning</option>
              <option value="danger">danger</option>
              <option value="success">success</option>
            </select>
          </div>
          <label class="label" for="">Type</label>
          <div class="select is-info mb-4">
            <select bind:value={event.type}>
              <option value="update">Update</option>
              <option value="tracking-info">Tracking info</option>
            </select>
          </div>
          {#if event.type === "tracking-info"}
            <label class="label" for="">Courier</label>
            <div class="select is-info mb-4">
              <select bind:value={tracking.courier}>
                <option value="ups" selected={tracking.courier === "ups"}
                  >UPS</option
                >
                <option value="brt" selected={tracking.courier === "brr"}
                  >BRT</option
                >
                <option value="dpd" selected={tracking.courier === "dpd"}
                  >DPD</option
                >
              </select>
            </div>
            <div class="mb-5">
              <label class="label" for="">Parcels</label>
              <input
                type="text"
                class="input mt-3"
                bind:value={tracking.parcels[0]}
              />
              <input
                type="text"
                class="input mt-3"
                bind:value={tracking.parcels[1]}
              />
              <input
                type="text"
                class="input mt-3"
                bind:value={tracking.parcels[2]}
              />
              <input
                type="text"
                class="input mt-3"
                bind:value={tracking.parcels[3]}
              />
            </div>
          {/if}
          <label class="label" for="">Message</label>
          <textarea class="textarea is-info" bind:value={event.text}></textarea>
          <button
            class="button is-info has-text-white mt-6"
            on:click={addEvent}
            type="button">Add event</button
          >
        </form>
      {/if}
    </div>
  </div>
{/if}
