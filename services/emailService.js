const nodemailer = require("nodemailer");
const User = require("../models/User");
const { templates } = require("../templates");
const { getSettings } = require("./settingsService");

/*
 * Central email service. Uses the same SMTP env vars as the password-reset email:
 * EMAIL_USER, EMAIL_PASSWORD, SMTP_HOST, SMTP_PORT (and optional EMAIL_FROM).
 * Credentials never leave the server. Sending failures are logged and reported to the caller,
 * but never throw — an email problem must not break an order, sign-up or form submission.
 */

let transporter = null;

const isEmailConfigured = () => Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD);

const getTransporter = () => {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 465);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port,
      secure: port === 465,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
      // Keep requests responsive if the SMTP server is slow or unreachable.
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }
  return transporter;
};

const frontendUrl = () =>
  String(process.env.FRONTEND_URL || "")
    .split(",")[0]
    .trim()
    .replace(/\/+$/, "");

const INVALID_ADMIN_EMAIL = "admin@local.invalid";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Admin notification recipient, in priority order:
 * Settings → notification email, primary admin account email, ADMIN_EMAIL, EMAIL_USER.
 */
const getAdminRecipient = async (settings) => {
  const candidates = [settings?.emails?.adminEmail];

  try {
    const primary = await User.findOne({ role: "admin", isPrimaryAdmin: true }).select("email").lean();
    candidates.push(primary?.email);
  } catch {
    // ignore — fall through to env values
  }

  candidates.push(process.env.ADMIN_EMAIL, process.env.EMAIL_USER);

  return (
    candidates
      .map((email) => String(email || "").trim().toLowerCase())
      .find((email) => email && email !== INVALID_ADMIN_EMAIL && EMAIL_PATTERN.test(email)) || null
  );
};

/** Low-level send. Resolves to { sent, skipped?, error? }. */
const sendEmail = async ({ to, subject, html, text, replyTo }) => {
  if (!to) return { sent: false, skipped: "no-recipient" };
  if (!isEmailConfigured()) return { sent: false, skipped: "not-configured" };

  try {
    const storeFrom = process.env.EMAIL_FROM || process.env.EMAIL_USER;
    await getTransporter().sendMail({ from: storeFrom, to, subject, html, text, replyTo });
    return { sent: true };
  } catch (error) {
    console.error(`Email "${subject}" to ${to} failed:`, error.message);
    return { sent: false, error: error.message };
  }
};

/**
 * Renders and sends one template.
 * @param {string} key       template key (orderCreated, orderStatusChanged, newUser, contactForm, newsletter)
 * @param {string} audience  "customer" | "admin"
 * @param {object} data      order / user / submission / subscriber
 * @param {object} options   { to, settings, previousStatus }
 */
const sendTemplate = async (key, audience, data, options = {}) => {
  try {
    const entry = templates[key];
    if (!entry || typeof entry.module[audience] !== "function") {
      return { sent: false, skipped: "unknown-template" };
    }

    const settings = options.settings || (await getSettings());
    const rawTemplate = settings?.emails?.templates?.[key];
    // Mongoose sub-documents must be converted before their fields can be spread.
    const templateSettings =
      rawTemplate && typeof rawTemplate.toObject === "function" ? rawTemplate.toObject() : rawTemplate || {};

    // Admins can switch off customer-facing templates; admin notifications always go out.
    if (audience === "customer" && templateSettings.enabled === false) {
      return { sent: false, skipped: "disabled" };
    }

    const to = audience === "admin" ? await getAdminRecipient(settings) : options.to;

    const message = entry.module[audience](data, {
      storeName: settings?.emails?.storeName || "Aura",
      template: audience === "customer" ? templateSettings : {},
      frontendUrl: frontendUrl(),
      previousStatus: options.previousStatus,
    });

    return sendEmail({ to, ...message });
  } catch (error) {
    console.error(`Email template "${key}" failed:`, error.message);
    return { sent: false, error: error.message };
  }
};

module.exports = {
  isEmailConfigured,
  getAdminRecipient,
  sendEmail,
  sendTemplate,
  frontendUrl,
};
