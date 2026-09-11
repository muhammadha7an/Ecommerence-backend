const Settings = require("../models/Settings");
const { normalizeShippingSettings } = require("./shippingService");

const TEMPLATE_KEYS = ["orderCreated", "orderStatusChanged", "newUser", "contactForm", "newsletter"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

class SettingsValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "SettingsValidationError";
    this.status = 400;
  }
}

/** Returns the settings document, creating it with defaults on first use. */
const getSettings = async () => {
  const settings = await Settings.findOneAndUpdate(
    { key: "store" },
    { $setOnInsert: { key: "store" } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return settings;
};

const getShippingSettings = async () => {
  const settings = await getSettings();
  return normalizeShippingSettings(settings.shipping || {});
};

const toMoney = (value, label, { max = 100000 } = {}) => {
  if (value === "" || value === null || value === undefined) {
    throw new SettingsValidationError(`${label} is required.`);
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new SettingsValidationError(`${label} must be a number of 0 or more.`);
  }
  if (number > max) {
    throw new SettingsValidationError(`${label} cannot be more than ${max}.`);
  }
  return Math.round(number * 100) / 100;
};

const cleanText = (value, max) => String(value ?? "").trim().slice(0, max);

/**
 * Applies a partial update from the admin Settings page.
 * Only known fields are accepted; everything is validated server-side.
 */
const updateSettings = async (payload = {}) => {
  const settings = await getSettings();

  if (payload.shipping) {
    const { freeShippingThreshold, shippingFee, methodName } = payload.shipping;
    settings.shipping.freeShippingThreshold = toMoney(freeShippingThreshold, "Free shipping threshold");
    settings.shipping.shippingFee = toMoney(shippingFee, "Shipping fee", { max: 10000 });
    if (methodName !== undefined) {
      settings.shipping.methodName = cleanText(methodName, 80) || "Standard shipping";
    }
  }

  if (payload.emails) {
    const { storeName, adminEmail, templates } = payload.emails;

    if (storeName !== undefined) {
      settings.emails.storeName = cleanText(storeName, 80) || "Aura";
    }

    if (adminEmail !== undefined) {
      const email = cleanText(adminEmail, 254).toLowerCase();
      if (email && !EMAIL_PATTERN.test(email)) {
        throw new SettingsValidationError("Notification email address is not valid.");
      }
      settings.emails.adminEmail = email;
    }

    if (templates && typeof templates === "object") {
      TEMPLATE_KEYS.forEach((key) => {
        const incoming = templates[key];
        if (!incoming || typeof incoming !== "object") return;

        const current = settings.emails.templates[key] || {};
        settings.emails.templates[key] = {
          enabled: incoming.enabled !== undefined ? Boolean(incoming.enabled) : current.enabled !== false,
          subject: incoming.subject !== undefined ? cleanText(incoming.subject, 200) : current.subject || "",
          heading: incoming.heading !== undefined ? cleanText(incoming.heading, 200) : current.heading || "",
          message: incoming.message !== undefined ? cleanText(incoming.message, 2000) : current.message || "",
        };
      });
      settings.markModified("emails.templates");
    }
  }

  await settings.save();
  return settings;
};

/** Public, non-sensitive subset used by the storefront. */
const publicSettings = (settings) => ({
  shipping: normalizeShippingSettings(settings.shipping || {}),
  storeName: settings.emails?.storeName || "Aura",
});

module.exports = {
  TEMPLATE_KEYS,
  SettingsValidationError,
  getSettings,
  getShippingSettings,
  updateSettings,
  publicSettings,
};
