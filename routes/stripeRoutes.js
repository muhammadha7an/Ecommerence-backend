const express = require("express");
const Stripe = require("stripe");
const authMiddleware = require("../middleware/authMiddleware");
const databaseMiddleware = require("../middleware/databaseMiddleware");
const { quoteCheckout, finalizeOrderFromSession, CheckoutError } = require("../services/orderService");

const router = express.Router();

const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  return new Stripe(process.env.STRIPE_SECRET_KEY);
};

const allowedOrigins = () =>
  String(process.env.FRONTEND_URL || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);

/** Only redirect Stripe back to a known frontend (falls back to the request origin in dev). */
const resolveOrigin = (requested) => {
  const origin = String(requested || "").trim().replace(/\/+$/, "");
  const allowed = allowedOrigins();
  if (!origin) return allowed[0] || "";
  if (allowed.length === 0 || allowed.includes(origin)) return origin;
  return allowed[0];
};

const metaText = (value, max = 200) => String(value || "").trim().slice(0, max);

// POST /api/create-checkout-session
// Body: { items: [{ id, quantity }], shippingDetails, origin }
// Prices, stock, shipping and totals are recalculated here from the database.
router.post("/create-checkout-session", databaseMiddleware, authMiddleware, async (req, res) => {
  try {
    const { items, shippingDetails = {} } = req.body || {};
    const origin = resolveOrigin(req.body?.origin);

    if (!origin) {
      return res.status(400).json({
        success: false,
        message: "Frontend URL is missing.",
      });
    }

    const { lines, shipping } = await quoteCheckout(items);

    const lineItems = lines.map((line) => ({
      price_data: {
        currency: "usd",
        product_data: {
          name: line.name,
          metadata: { productId: line.productId, image: metaText(line.image, 450) },
        },
        unit_amount: line.unitCents,
      },
      quantity: line.quantity,
    }));

    if (shipping.shippingCents > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: shipping.methodName, metadata: { kind: "shipping" } },
          unit_amount: shipping.shippingCents,
        },
        quantity: 1,
      });
    }

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      billing_address_collection: "required",
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout`,
      payment_method_types: ["card"],
      // Short-lived session keeps the gap between the stock check and payment small.
      expires_at: Math.floor(Date.now() / 1000) + 35 * 60,
      metadata: {
        userId: String(req.userId),
        subtotalCents: String(shipping.subtotalCents),
        shippingCents: String(shipping.shippingCents),
        shippingMethod: metaText(shipping.methodName, 80),
        shipName: metaText(shippingDetails.fullName, 120),
        shipEmail: metaText(shippingDetails.email, 254),
        shipPhone: metaText(shippingDetails.phone, 40),
        shipAddress: metaText(shippingDetails.address, 300),
        shipCity: metaText(shippingDetails.city, 100),
        shipPostalCode: metaText(shippingDetails.postalCode, 20),
      },
    });

    return res.json({
      success: true,
      url: session.url,
      summary: {
        subtotal: shipping.subtotalCents / 100,
        shipping: shipping.shippingCents / 100,
        total: shipping.totalCents / 100,
        isFreeShipping: shipping.isFree,
      },
    });
  } catch (error) {
    if (error instanceof CheckoutError) {
      return res.status(error.status).json({
        success: false,
        code: error.code || "CHECKOUT_INVALID",
        message: error.message,
        issues: error.issues || [],
      });
    }

    console.error("Stripe Error:", error);
    return res.status(500).json({
      success: false,
      message: "We couldn't start the secure payment. Please try again in a moment.",
    });
  }
});

// GET /api/checkout-session/:sessionId — confirms payment and records the order (idempotent)
router.get("/checkout-session/:sessionId", databaseMiddleware, authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.metadata?.userId !== String(req.userId)) {
      return res.status(403).json({ success: false, message: "Order does not belong to this user" });
    }

    if (session.payment_status !== "paid") {
      return res.status(400).json({
        success: false,
        message: "Payment has not been completed.",
      });
    }

    const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, {
      limit: 100,
      expand: ["data.price.product"],
    });

    const { order } = await finalizeOrderFromSession({
      session,
      lineItems: lineItems.data,
      userId: req.userId,
    });

    const productItems = lineItems.data.filter((item) => item.price?.product?.metadata?.kind !== "shipping");

    return res.json({
      success: true,
      savedOrderId: order._id,
      order: {
        sessionId: session.id,
        orderId: order._id,
        paymentStatus: session.payment_status,
        status: session.status,
        amountTotal: session.amount_total,
        subtotalAmount: order.subtotalAmount,
        shippingFee: order.shippingFee,
        shippingMethod: order.shippingMethod,
        currency: session.currency,
        customer: {
          name: order.shippingDetails?.fullName || session.customer_details?.name || "",
          email: session.customer_details?.email || "",
          phone: order.shippingDetails?.phone || session.customer_details?.phone || "",
          address: order.shippingDetails?.address || session.customer_details?.address || null,
        },
        items: productItems.map((item) => ({
          id: item.id,
          name: item.description,
          quantity: item.quantity,
          amountTotal: item.amount_total,
          currency: item.currency,
        })),
      },
    });
  } catch (error) {
    console.error("Order Retrieval Error:", error);
    return res.status(500).json({
      success: false,
      message: "We couldn't confirm this order right now. Please refresh the page or check My Orders.",
    });
  }
});

module.exports = router;
