import { mongoose } from "mongoose";
const { Schema } = mongoose;

const orderEventSchema = new Schema({
  ts: {
    type: Date,
    default: Date.now(),
  },
  level: {
    type: String,
    enum: ["info", "warning", "danger", "success"],
    default: "info",
  },
  type: String,
  data: Object,
});

const orderSchema = new Schema(
  {
    id: {
      type: String,
      unique: true,
    },
    status: {
      type: String,
      enum: ["ready", "to-be-shipped", "shipped", "exception"],
      default: "ready",
    },
    kettleblazeId: String,
    stripeSessionId: String,
    customer: Object,
    products: Array,
    shippingCost: Object,
    paymentMethod: Object,
    events: [orderEventSchema],
  },
  { collection: "orders2" }
);

const Order = mongoose.model("Order", orderSchema);
export default Order;
