import dotenv from "dotenv";
dotenv.config();
import { getCountryData } from "countries-list";
import Order from "./models/order.mjs";
import { mongoose } from "mongoose";
import Stripe from "stripe";
let stripe = new Stripe(process.env.STRIPE_API_KEY);
async function connect() {
  const connection = await mongoose.connect(
    `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@us-kettleblaze-store.kkgp7uh.mongodb.net/kettleblaze_store?retryWrites=true&w=majority`
  );
}

export default async (request, context) => {
  const orderId = context.url.searchParams.get("id");
console.log(orderId)
  await connect();
  const o = await Order.findOne({ id: orderId });

  return Response.json(o);
};
