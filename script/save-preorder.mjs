import dotenv from "dotenv";
dotenv.config();
import { getCountryData } from "countries-list";
import Stripe from "stripe";
import { nanoid } from "nanoid";
import { mongoose } from "mongoose";
import Order from "../functions/getOrder/models/order.mjs";
import { titleCase } from "title-case";
let stripe = new Stripe(process.env.STRIPE_API_KEY);
async function connect() {
  const connection = await mongoose.connect(
    `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@us-kettleblaze-store.kkgp7uh.mongodb.net/kettleblaze_store?retryWrites=true&w=majority`
  );
}

function createOrderId(unixTs) {
  const d = new Date(unixTs * 1000);
  return `KB-${d.getFullYear()}${d.getMonth()}${d.getDate()}-${d.getHours()}${d.getMinutes()}`;
}

(async () => {
  let sessions = [
    "cs_live_b1PeXZLYRiNaSAm7nreoLok3pW4NIt6cdziP1EIoOWyFh4cHHrcXuVLddb",
    "cs_live_b1SPu0dHM0Q9dNswFAfTAXhq90I9UNEVkoc1uuZVUWJBJkKxo1fKOzj5ty",
    "cs_live_b16yDN1Z47JlllPMxxKmVbxiWv3FySN28kwRTn75Z89sLt8zRZbEAB1wbw",
    "cs_live_b1BIh2of16v4kCpenaLnxrX8OOIBbXaZCZ65SE0LsaaQGhoIi5BLeGD3Be",
    "cs_live_b11EVV2aYb6myOlOo4OFoGG5SRJiUbSYvEcua8TUgp2b5HTZCJF2uaDHgv",
    "cs_live_b1A00cmNaMKREz340BX1AZOXkg4WHiP5OrkLZSl73emJe2v996Nf3YWaa9",
    "cs_live_b1hKDlKYkygU7EhZVfAv7igXeZoG0I4zKM5pYU8jC7SXqCzlRTfrCLql6V",
    "cs_live_b16b9zMShDaLUoBmtK9GQIcGnK3EjpeU0NvC8iMuQZqGSc5VZ0KbrNq4cE",
    "cs_live_b1bubo5ztY1vAa1Vq8AMo7YxrSxzRhF9cPGu6S2WDkGMAFwhnfzk7sLmVM",
  ];
  for (let s of sessions) {
    const uuid = nanoid(8);
    const sessionId = s;

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const items = await stripe.checkout.sessions.listLineItems(sessionId);
    const intent = await stripe.paymentIntents.retrieve(session.payment_intent);
    const method = await stripe.paymentMethods.retrieve(intent.payment_method);

    let customer = session.customer_details;

    customer.shipping_details = session.shipping_details;
    customer.address.country_data = getCountryData(customer.address.country);

    let products = [];
    let shippingCost = null;

    let paymentMethod = null;

    if (method) {
      console.log(method);
      paymentMethod = {
        type: method.type,
        card: method.card?.brand ? titleCase(method.card?.brand) : null,
        wallet: method.card?.wallet?.type || null,
      };
    }
    if (session.shipping_cost) {
      shippingCost = {
        amount_total: session.shipping_cost.amount_total,
        currency: session.currency,
      };
    }

    for (let item of items.data) {
      let name = "",
        description = "",
        extras = [];
      if (item.price.product === "prod_RKdZSNJEka6494") {
        name = "FlexiBell2";
        description = "Steel adjustable competition kettlebell";
      } else if (item.price.product === "prod_OiN77T3NMknrjK") {
        name = "ZeroVibe";
        description = "Vibration dampener for the FlexiBell 2";
        let [zerovibeType] = session.custom_fields.filter(
          (field) => field.key === "zerovibetype"
        );
        let type =
          zerovibeType.dropdown?.value === "3x25cm"
            ? "3x2.5cm"
            : "1x5cm + 1x2.5cm";
        extras = [
          {
            name: "type",
            value: type,
          },
        ];
      } else if (item.price.product === "prod_RRlpGcJTAJgKAX") {
        name = "10€ Magneti-X Discount Coupon";
        description = "Coupon code: MAGNETIX-25";
      } else {
        name = item.description;
        description = "";
      }
      products = products.concat([
        {
          sku: item.price.product,
          price: item.amount_total,
          name,
          description,
          extras,
          quantity: item.quantity,
          currency: item.currency,
        },
      ]);
    }
    let [tshirtSize] = session.custom_fields.filter(
      (field) => field.key === "freetshirtsize"
    );
    if (tshirtSize) {
      products = products.concat([
        {
          quantity: 1,
          sku: "prod_AI839Kll1kzw23",
          name: "Free Kettleblaze T-Shirt",
          description:
            "Cotton t-shirt with front and back Kettleblaze logo embroidery.",
          extras: [{ name: "size", value: tshirtSize.dropdown.value }],
        },
      ]);
    }

    let order = {
      id: uuid,
      status: "waiting-product",
      kettleblazeId: createOrderId(session.created),
      stripeSessionId: session.id,
      products,
      customer,
      shippingCost,
      paymentMethod,
    };

    order.events = [];
    order.events.push({
      ts: session.created * 1000,
      type: "created",
      data: {
        text: "Pre-order created successfully!",
      },
    });

    order.events.push({
      ts: Date.now(),
      type: "update",
      data: {
        text: "Product is expected to arrive 27th/29th Jan 25. Delivery to our warehouse the following week and then priority shipping.",
      },
    });

    order.events.push({
      ts: Date.now(),
      level: "warning",
      type: "update",
      data: {
        text: "Please insert your mobile phone number in the fields above",
      },
    });

    await connect();
    const ord = await Order.findOneAndUpdate(
      { stripeSessionId: order.stripeSessionId },
      order,
      { new: true, upsert: true }
    );
  }
})();
