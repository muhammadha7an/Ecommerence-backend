const express = require("express");
const ContactSubmission = require("../models/ContactSubmission");
const { sendTemplate } = require("../services/emailService");
const { getSettings } = require("../services/settingsService");

const router = express.Router();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Light in-memory rate limit (per server instance): 5 messages per IP per 10 minutes.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const recent = new Map();

const isRateLimited = (ip) => {
  const now = Date.now();
  const hits = (recent.get(ip) || []).filter((time) => now - time < WINDOW_MS);
  hits.push(now);
  recent.set(ip, hits);
  if (recent.size > 5000) recent.clear();
  return hits.length > MAX_PER_WINDOW;
};

const clean = (value, max) => String(value ?? "").trim().slice(0, max);

// POST /api/contact — public contact form
router.post("/", async (req, res) => {
  try {
    // Hidden honeypot field: real visitors leave it empty.
    if (clean(req.body?.website, 200)) {
      return res.status(201).json({ success: true, message: "Thank you! Your message has been sent." });
    }

    const name = clean(req.body?.name, 100);
    const email = clean(req.body?.email, 254).toLowerCase();
    const subject = clean(req.body?.subject, 150);
    const message = clean(req.body?.message, 5000);

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ success: false, message: "Please fill in your name, email, subject and message." });
    }
    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ success: false, message: "Please enter a valid email address." });
    }
    if (message.length < 10) {
      return res.status(400).json({ success: false, message: "Your message is a little short. Please add a few more details." });
    }

    const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
    if (isRateLimited(ip)) {
      return res.status(429).json({ success: false, message: "You've sent several messages recently. Please try again in a few minutes." });
    }

    const submission = await ContactSubmission.create({ name, email, subject, message });

    const settings = await getSettings();
    const [customerMail, adminMail] = await Promise.all([
      sendTemplate("contactForm", "customer", submission, { to: submission.email, settings }),
      sendTemplate("contactForm", "admin", submission, { settings }),
    ]);

    return res.status(201).json({
      success: true,
      message: "Thank you! Your message has been sent. We'll get back to you soon.",
      confirmationEmailSent: Boolean(customerMail.sent),
      adminNotified: Boolean(adminMail.sent),
    });
  } catch (error) {
    console.error("Contact submission error:", error);
    return res.status(500).json({
      success: false,
      message: "We couldn't send your message right now. Please try again later.",
    });
  }
});

module.exports = router;
