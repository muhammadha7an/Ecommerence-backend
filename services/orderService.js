const mongoose = require("mongoose");
const Product = require("../models/Product");
const Order = require("../models/Order");
const User = require("../models/User");
const { calculateShipping, toCents } = require("./shippingService");
const { getSettings } = require("./settingsService");
const { sendTemplate } = require("./emailService");

/*
 * Order service — everything money- or stock-related is decided here, on the server.
 * The browser only tells us WHICH products and HOW MANY; prices, stock, shipping and totals
 * are always re-read from MongoDB and the admin shipping settings.
 */

const MAX_QUANTITY_PER_LINE = 99;

class CheckoutError extends Error {
  constructor(message, status = 400, extra = {}) {
    super(message);
    this.name = "CheckoutError";
    this.status = status;
    Object.assign(this, extra);
  }
}

/** Same rule the storefront uses: a valid sale price below the regular price wins. */
const getEffectivePrice = (product) => {
  const price = Number(product.price || 0);
  const sale = Number(product.salePrice);
  return Number.isFinite(sale) && sale > 0 && sale < price ? sale : price;
};

const availableStock = (product) => {
  if (product.inStock === false) return 0;
  const stock = Number(product.stock);
  return Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : 0;
};

const findProductForId = async (rawId) => {
  const id = String(rawId || "").trim();
  if (!id) return null;
  if (mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id) {
    const product = await Product.findById(id);
    if (product) return product;
  }
  if (/^\d+$/.test(id)) {
    return Product.findOne({ legacyId: Number(id) });
  }
  return null;
};

/**
 * Validates cart lines against the database.
 * @param {Array<{id|_id|productId, quantity}>} items  raw items from the browser
 * @returns {{ lines, subtotalCents }}  or throws CheckoutError with `issues`
 */
const validateCart = async (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new CheckoutError("Your cart is empty.");
  }
  if (items.length > 50) {
    throw new CheckoutError("Too many different products in one order.");
  }

  // Merge duplicate lines for the same product.
  const requested = new Map();
  for (const item of items) {
    const id = String(item?.productId || item?._id || item?.id || "").trim();
    const quantity = Number(item?.quantity);
    if (!id || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY_PER_LINE) {
      throw new CheckoutError("Your cart contains an invalid item or quantity. Please refresh your cart.");
    }
    const entry = requested.get(id) || { id, quantity: 0, name: String(item?.name || "") };
    entry.quantity += quantity;
    requested.set(id, entry);
  }

  const lines = [];
  const issues = [];

  for (const entry of requested.values()) {
    const product = await findProductForId(entry.id);

    if (!product) {
      issues.push({ productId: entry.id, name: entry.name || "A product", requested: entry.quantity, available: 0, reason: "unavailable" });
      continue;
    }

    const stock = availableStock(product);
    if (stock <= 0) {
      issues.push({ productId: String(product._id), name: product.name, requested: entry.quantity, available: 0, reason: "out_of_stock" });
      continue;
    }
    if (entry.quantity > stock) {
      issues.push({ productId: String(product._id), name: product.name, requested: entry.quantity, available: stock, reason: "insufficient_stock" });
      continue;
    }

    const unitPrice = getEffectivePrice(product);
    const unitCents = toCents(unitPrice);
    if (unitCents <= 0) {
      issues.push({ productId: String(product._id), name: product.name, requested: entry.quantity, available: stock, reason: "unavailable" });
      continue;
    }

    lines.push({
      productId: String(product._id),
      name: product.name,
      image: product.image || "",
      unitCents,
      unitPrice: unitCents / 100,
      quantity: entry.quantity,
      lineCents: unitCents * entry.quantity,
    });
  }

  if (issues.length) {
    const first = issues[0];
    const message =
      first.reason === "insufficient_stock"
        ? `Only ${first.available} of "${first.name}" ${first.available === 1 ? "is" : "are"} available. Please update your cart.`
        : `"${first.name}" is no longer available. Please remove it from your cart.`;
    throw new CheckoutError(message, 409, { code: "STOCK_CHANGED", issues });
  }

  const subtotalCents = lines.reduce((sum, line) => sum + line.lineCents, 0);
  return { lines, subtotalCents };
};

/** Validates the cart and applies the admin shipping rules. */
const quoteCheckout = async (items) => {
  const { lines, subtotalCents } = await validateCart(items);
  const settings = await getSettings();
  const shipping = calculateShipping(subtotalCents, settings.shipping || {});
  return { lines, shipping, settings };
};

/*
 * Stock is deducted exactly once, by the request that creates the order.
 * Each deduction is atomic ($inc guarded by stock >= qty), so two simultaneous orders can never
 * push stock below zero.
 */
const deductStock = async (items) => {
  const issues = [];

  for (const item of items) {
    if (!item.productId || !mongoose.Types.ObjectId.isValid(item.productId)) continue;
    const quantity = Number(item.quantity || 0);
    if (quantity <= 0) continue;

    const result = await Product.updateOne(
      { _id: item.productId, stock: { $gte: quantity } },
      { $inc: { stock: -quantity } }
    );

    if (result.modifiedCount === 0) {
      // Paid, but someone else bought the last units in the meantime: record it for the admin.
      const product = await Product.findById(item.productId).select("stock name").lean();
      issues.push({
        productId: item.productId,
        name: product?.name || item.name,
        requested: quantity,
        available: Math.max(0, Number(product?.stock || 0)),
      });
      await Product.updateOne({ _id: item.productId }, { $set: { stock: 0, inStock: false } });
    }

    await Product.updateOne({ _id: item.productId, stock: { $lte: 0 } }, { $set: { inStock: false } });
  }

  return issues;
};

const readMetadataCents = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : null;
};

const buildShippingDetails = (session) => {
  const meta = session.metadata || {};
  const stripeDetails = session.customer_details || {};
  const hasFormAddress = Boolean(meta.shipAddress || meta.shipCity);

  return {
    fullName: meta.shipName || stripeDetails.name || "",
    email: stripeDetails.email || meta.shipEmail || "",
    phone: meta.shipPhone || stripeDetails.phone || "",
    address: hasFormAddress
      ? { line1: meta.shipAddress || "", city: meta.shipCity || "", postal_code: meta.shipPostalCode || "", country: stripeDetails.address?.country || "" }
      : stripeDetails.address || null,
    billingAddress: stripeDetails.address || null,
  };
};

/**
 * Turns a paid Stripe Checkout session into an Order (idempotent).
 * @returns {{ order, created }}
 */
const finalizeOrderFromSession = async ({ session, lineItems, userId }) => {
  const existing = await Order.findOne({ stripeSessionId: session.id });
  if (existing) return { order: existing, created: false };

  const meta = session.metadata || {};
  const productLines = lineItems.filter((item) => item.price?.product?.metadata?.kind !== "shipping");
  const shippingLine = lineItems.find((item) => item.price?.product?.metadata?.kind === "shipping");

  const items = productLines.map((item) => {
    const productId = item.price?.product?.metadata?.productId || null;
    return {
      id: productId || item.id,
      productId,
      name: item.description,
      image: item.price?.product?.metadata?.image || "",
      price: (item.amount_total || 0) / 100 / (item.quantity || 1),
      quantity: item.quantity,
    };
  });

  const itemsCents = productLines.reduce((sum, item) => sum + (item.amount_total || 0), 0);
  const shippingFee = readMetadataCents(meta.shippingCents) ?? (shippingLine ? shippingLine.amount_total || 0 : 0);

  let order;
  try {
    order = await Order.create({
      userId,
      stripeSessionId: session.id,
      items,
      subtotalAmount: readMetadataCents(meta.subtotalCents) ?? itemsCents,
      shippingFee,
      shippingMethod: meta.shippingMethod || (shippingFee > 0 ? "Standard shipping" : "Free shipping"),
      totalAmount: session.amount_total || 0,
      currency: session.currency || "usd",
      paymentStatus: session.payment_status,
      orderStatus: session.status === "complete" ? "processing" : session.status,
      shippingDetails: buildShippingDetails(session),
    });
  } catch (error) {
    // Another request (e.g. a page refresh) created it first — use that one, no side effects.
    if (error?.code === 11000) {
      return { order: await Order.findOne({ stripeSessionId: session.id }), created: false };
    }
    throw error;
  }

  // Side effects run only for the request that created the order.
  try {
    order.inventoryIssues = await deductStock(items);
    order.stockAdjusted = true;
  } catch (error) {
    console.error("Stock deduction failed for order", String(order._id), error.message);
  }

  try {
    const settings = await getSettings();
    const account = await User.findById(userId).select("email name").lean();
    const customerEmail = order.shippingDetails?.email || account?.email;
    const [customerMail, adminMail] = await Promise.all([
      sendTemplate("orderCreated", "customer", order, { to: customerEmail, settings }),
      sendTemplate("orderCreated", "admin", order, { settings }),
    ]);
    order.notifications = { customerOrderEmail: customerMail.sent, adminOrderEmail: adminMail.sent };
  } catch (error) {
    console.error("Order emails failed for order", String(order._id), error.message);
  }

  await order.save();
  return { order, created: true };
};

module.exports = {
  CheckoutError,
  getEffectivePrice,
  availableStock,
  validateCart,
  quoteCheckout,
  deductStock,
  finalizeOrderFromSession,
};
