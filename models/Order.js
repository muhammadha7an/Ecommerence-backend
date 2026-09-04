const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    stripeSessionId: { type: String, required: true, unique: true },
    items: [{
      id: String,
      name: String,
      image: String,
      price: Number,
      quantity: Number,
    }],
    totalAmount: { type: Number, required: true },
    currency: { type: String, default: "usd" },
    paymentStatus: { type: String, default: "unpaid" },
    orderStatus: { type: String, default: "processing" },
    shippingDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);