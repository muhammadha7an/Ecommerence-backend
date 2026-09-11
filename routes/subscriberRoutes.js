const express = require("express");
 
const nodemailer = require("nodemailer");
const Subscriber = require("../models/Subscriber");
 
const Subscriber = require("../models/Subscriber");
const { sendTemplate } = require("../services/emailService");
 

const router = express.Router();
const { EMAIL_PATTERN } = Subscriber;
const ALLOWED_SOURCES = ["home", "footer", "website"];

 
const isEmailConfigured = () =>
  Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD);

// Same SMTP settings as the password-reset email in authController.
const createTransporter = () =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

const confirmationEmailHtml = (shopUrl) => `
  <div style="margin:0;padding:32px 16px;background:#eef1ea;font-family:Arial,Helvetica,sans-serif;color:#1f2a27;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #dce2d6;border-radius:14px;overflow:hidden;">
      <div style="padding:28px 32px;background:#1f2a27;">
        <span style="font-family:Georgia,'Times New Roman',serif;font-size:28px;color:#ffffff;">Aura<span style="color:#e0a58f;">.</span></span>
      </div>
      <div style="padding:32px;">
        <h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:normal;color:#1f2a27;">
          You're on the list.
        </h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4d5955;">
          Thank you for subscribing to the Aura newsletter. You'll be first to hear about new releases,
          restocks and styling notes.
        </p>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4d5955;">
          We only send emails worth opening, and never share your address.
        </p>
        <a href="${shopUrl}" style="display:inline-block;padding:12px 24px;background:#ad4b2f;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;font-size:14px;">
          Browse the shop
        </a>
      </div>
      <div style="padding:18px 32px;border-top:1px solid #eef1ea;font-size:12px;color:#87918d;">
        You received this email because this address was subscribed on our website.
        If this wasn't you, you can ignore this message.
      </div>
    </div>
  </div>
`;

const sendConfirmationEmail = async (email) => {
  if (!isEmailConfigured()) return false;

  const shopUrl = `${(process.env.FRONTEND_URL || "").replace(/\/$/, "")}/shop`;

  await createTransporter().sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: email,
    subject: "Welcome to the Aura newsletter",
    text:
      "Thank you for subscribing to the Aura newsletter. You'll be first to hear about new releases, restocks and styling notes.",
    html: confirmationEmailHtml(shopUrl),
  });

  return true;
};

 
// POST /api/subscribers — public newsletter sign-up (Home + Footer forms)
router.post("/", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const source = ALLOWED_SOURCES.includes(req.body?.source) ? req.body.source : "website";

    if (!email) {
      return res.status(400).json({ success: false, message: "Please enter your email address." });
    }

    if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ success: false, message: "Please enter a valid email address." });
    }

    const existing = await Subscriber.findOne({ email });

    if (existing && existing.status === "active") {
      return res.status(409).json({
        success: false,
        message: "This email is already subscribed to our newsletter.",
      });
    }

    let subscriber;
    if (existing) {
      // Previously unsubscribed — reactivate instead of creating a duplicate
      existing.status = "active";
      existing.source = source;
      subscriber = await existing.save();
    } else {
      subscriber = await Subscriber.create({ email, source });
    }

    // Email failures must never undo a successful subscription.
 
    let emailSent = false;
    try {
      emailSent = await sendConfirmationEmail(subscriber.email);
    } catch (mailError) {
      console.error("Newsletter confirmation email failed:", mailError.message);
    }
 
    const mail = await sendTemplate("newsletter", "customer", { email: subscriber.email }, { to: subscriber.email });
    const emailSent = Boolean(mail.sent);
 

    return res.status(201).json({
      success: true,
      message: "Thank you for subscribing!",
      emailSent,
      subscriber: {
        email: subscriber.email,
        status: subscriber.status,
        createdAt: subscriber.createdAt,
      },
    });
  } catch (error) {
    // Unique index race: two requests with the same email at once
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This email is already subscribed to our newsletter.",
      });
    }

    if (error?.name === "ValidationError") {
      return res.status(400).json({ success: false, message: "Please enter a valid email address." });
    }

    console.error("Newsletter subscribe error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to subscribe right now. Please try again later.",
    });
  }
});

module.exports = router;
