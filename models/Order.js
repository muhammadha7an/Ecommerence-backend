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
      productId: { type: String, default: null },
      name: String,
      image: String,
      price: Number,
      quantity: Number,
    }],
    // All money fields are stored in cents, like totalAmount.
    // Older orders do not have subtotal/shipping fields; they default to null.
    subtotalAmount: { type: Number, default: null },
    shippingFee: { type: Number, default: null },
    shippingMethod: { type: String, default: null },
    totalAmount: { type: Number, required: true },
    currency: { type: String, default: "usd" },
    paymentStatus: { type: String, default: "unpaid" },
    orderStatus: { type: String, default: "processing" },
    shippingDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Set once stock has been deducted for this order (prevents double deduction).
    stockAdjusted: { type: Boolean, default: false },
    // Products that no longer had enough stock when the paid order was recorded.
    inventoryIssues: {
      type: [{
        _id: false,
        productId: String,
        name: String,
        requested: Number,
        available: Number,
      }],
      default: [],
    },
    notifications: {
      customerOrderEmail: { type: Boolean, default: false },
      adminOrderEmail: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);