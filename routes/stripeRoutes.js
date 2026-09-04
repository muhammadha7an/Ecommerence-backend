const express = require("express");
const Stripe = require("stripe");

const router = express.Router();

const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  return new Stripe(process.env.STRIPE_SECRET_KEY);
};

router.post("/create-checkout-session", async (req, res) => {
  try {
    const { items, origin } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty.",
      });
    }

    if (!origin) {
      return res.status(400).json({
        success: false,
        message: "Frontend URL is missing.",
      });
    }

    const lineItems = items.map((item) => ({
      price_data: {
        currency: "usd",
        product_data: { name: String(item.name || "Product") },
        unit_amount: Math.round(Number(item.price) * 100),
      },
      quantity: Number(item.quantity),
    }));

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      billing_address_collection: "required",
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout`,
      payment_method_types: ["card"],
    });

    return res.json({ success: true, url: session.url });
  } catch (error) {
    console.error("Stripe Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Unable to create Stripe session.",
    });
  }
});

router.get("/checkout-session/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return res.status(400).json({
        success: false,
        message: "Payment has not been completed.",
      });
    }

    const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, {
      limit: 100,
    });

    return res.json({
      success: true,
      order: {
        sessionId: session.id,
        paymentStatus: session.payment_status,
        status: session.status,
        amountTotal: session.amount_total,
        currency: session.currency,
        customer: {
          name: session.customer_details?.name || "",
          email: session.customer_details?.email || "",
          phone: session.customer_details?.phone || "",
          address: session.customer_details?.address || null,
        },
        items: lineItems.data.map((item) => ({
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
      message: error.message || "Unable to retrieve order.",
    });
  }
});

module.exports = router;