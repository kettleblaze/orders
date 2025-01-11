<script lang="js">
  import SirvImage from "./SirvImage.svelte";

  function formatCurrency(value) {
    return new Intl.NumberFormat("en-IT", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 2,
    }).format(value / 100);
  }

  let order = {
    id: "KB-2912392-12",
    customer: {
      name: "Michael Cane",
      phone: "+01 283202 98",
      email: "michael.cane@gmail.com",
    },
    products: [
      {
        sku: "prod_N1V8kEQDCAc5SY",
        name: "FlexiBell 2",
        description: "Adjustable competition kettlebell 12kg-32kg",
        quantity: 2,
        price: 25500,
      },
      {
        sku: "prod_OiN77T3NMknrjK",
        name: "ZeroVibe 2",
        description: "Vibration dampener for the FlexiBell2",
        quantity: 2,
        price: 750,
      },
    ],
  };
</script>

<h1 class="title has-text-centered has-text-info">ORDER {order.id}</h1>
<ul class="has-text-centered">
  <li>{order.customer.name}</li>
  <li>{order.customer.phone}</li>
  <li>{order.customer.email}</li>
</ul>
<div class="box my-6">
  {#if order.products.length > 0}
    <ul>
      {#each order.products as product}
        <li>
          <div class="columns is-align-items-center">
            <div class="column">
              <SirvImage
                src="https://cdn.kettleblaze.store/orders/{product.sku}.jpg"
                width="480"
                height="480"
                displayWidth="120"
                displayHeight="120"
                quality="98"
              ></SirvImage>
              <div class="column">
                <h4 class="title has-text-info is-size-5">
                  {product.quantity} x {product.name}
                </h4>
                <p class="is-size-6">{product.description}</p>
                <p class="is-size-5 my-3 has-text-info">
                  {formatCurrency(product.price)}
                </p>
              </div>
            </div>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>
