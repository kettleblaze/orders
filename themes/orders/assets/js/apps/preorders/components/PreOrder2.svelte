<script lang="js">
  import { onMount } from "svelte";
  import SirvImage from "./SirvImage.svelte";
  import { translate as T, getPreferredLanguage } from "../i18n/utils.js";

  let isUpdating = false;
  let order = null;
  let errorOrNotFound = false;
  let event = {};
  let orderStatus = "";
  let tracking = { courier: "ups", parcels: [] };

  const trackingLinks = {
    ups: "https://www.ups.com/track?loc=en_GB&tracknum=PARCELNUM&requester=WT/trackdetails",
  };

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
    await fetch(`process.env.storeServer/order/${order.orderId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order),
    });
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
                            {T(name)}: {name === "size" ? value.toUpperCase() : T(value)}
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
            .postal_code}
        </li>
        <li>{order.customerData.address.country}</li>
      </ul>
    </div>
  </div>
{/if}
