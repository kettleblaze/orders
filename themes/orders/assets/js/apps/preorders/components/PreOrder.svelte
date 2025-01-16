<script lang="js">
  import { onMount } from "svelte";
  import SirvImage from "./SirvImage.svelte";

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

  function displayPaymentMethod(pm) {
    let type = "",
      wallet = "";
    if (pm.type === "card") {
      type = pm.card;
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
    switch (status) {
      case "ready":
        return "Ready";
      case "to-be-shipped":
        return "To be shipped";
      case "shipped":
        return "Shipped";
    }
  }
  function calculateTotal(order) {
    let sum = 0;
    for (let product of order.products) {
      if (product.price) {
        sum = sum + product.price;
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

  async function getOrder() {
    const params = new URLSearchParams(window.location.search);
    const o = await fetch(
      `https://kettleblaze-store-server.fly.dev/order/${params.get("id")}`,
      { method: "GET" }
    ).then((r) => r.json());
    //  order.customer = o.customer;
    return o;
  }
</script>

{#await getOrder()}
  <div class="sloader-container">
    <span class="sloader"></span>
    <h3 class="is-size-5">Please wait</h3>
  </div>
{:then order}
  <div class="columns">
    <div class="column">
      <h2 class="title my-6 px-5">Order Summary</h2>
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
                    </div>
                  </div>
                </div>
              </li>
            {/each}
            {#if order.shippingCost}
              <li>
                <div class="column">
                  <h4 class="title has-text-info is-size-4">Shipping Cost</h4>
                  <p class="is-size-5 my-3">
                    {formatCurrency(order.shippingCost)}
                  </p>
                </div>
              </li>
            {/if}
            <li>
              <div class="column">
                <hr />
                <h4 class="title has-text-info is-size-4 mt-5">Order total</h4>
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
        <h2 class="title">Order details</h2>
        <ul>
          <li>Id: {order.kettleblazeId}</li>
          <li>Payment method: {displayPaymentMethod(order.paymentMethod)}</li>
          <li>
            Payment status: <span class="has-text-info has-text-weight-bold"
              >paid</span
            >
          </li>
        </ul>
        <h2 class="title mt-6">Order Status</h2>
        <h2 class="title has-text-info has-text-weight-bold">
          {displayOrderStatus(order.status)}
        </h2>
        <h2 class="title mt-6">Customer details</h2>
        <ul>
          <li>Name: {order.customer.name}</li>
          <li>
            Phone: +{order.customer.address.country_data.phone[0]}
            {order.customer.phone}
          </li>
          <li>Email: {order.customer.email}</li>
        </ul>
        <h2 class="title mt-6">Shipping Address</h2>
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
      <div class="my-6">
        <h2 class="title pt-2">History</h2>
        {#each order.events as event}
          {#if event.type === "tracking-info"}
            <div class="mt-5">
              <div>
                <span class="has-text-{event.level}"
                  >• {new Date(event.ts).toLocaleDateString()}
                  {new Date(event.ts).toLocaleTimeString()}</span
                >
              </div>
              <div class="px-3">
                <span class="my-0">Tracking information</span>
                <div class="px-3 py-4">
                  <ul>
                    <li>Courier: {event.data.courier}</li>
                    <li>Parcels: {event.data.parcels.length}</li>
                    {#each event.data.parcels as parcel, index}
                      <li>
                        - <a
                          class="is-underlined"
                          target="_blank"
                          href={trackingLinks[
                            event.data.courier.toLowerCase()
                          ].replace("PARCELNUM", parcel)}
                          >Parcel {index + 1} tracking</a
                        >
                      </li>
                    {/each}
                  </ul>
                </div>
              </div>
            </div>
          {:else}
            <div class="mt-5">
              <div>
                <span class="has-text-{event.level}"
                  >• {new Date(event.ts).toLocaleDateString()}
                  {new Date(event.ts).toLocaleTimeString()}</span
                >
              </div>
              <div class="px-3">
                <span>{event.data.text}</span>
              </div>
            </div>
          {/if}
        {/each}
      </div>
    </div>
  </div>
{/await}
