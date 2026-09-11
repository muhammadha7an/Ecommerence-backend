const mongoose = require("mongoose");

/*
 * Store-wide settings managed from Admin → Settings.
 * A single document (key: "store") holds everything; missing fields fall back to defaults,
 * so the store works before an admin ever opens the Settings page.
 */

const templateSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: true },
    subject: { type: String, default: "", trim: true, maxlength: 200 },
    heading: { type: String, default: "", trim: true, maxlength: 200 },
    message: { type: String, default: "", trim: true, maxlength: 2000 },
  },
  { _id: false }
);

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "store", unique: true },
    shipping: {
      freeShippingThreshold: { type: Number, default: 78, min: 0 },
      shippingFee: { type: Number, default: 10, min: 0 },
      methodName: { type: String, default: "Standard shipping", trim: true, maxlength: 80 },
    },
    emails: {
      storeName: { type: String, default: "Aura", trim: true, maxlength: 80 },
      // Where admin notifications (new orders, contact messages) are delivered.
      // Empty = use the primary admin account email / ADMIN_EMAIL / EMAIL_USER.
      adminEmail: { type: String, default: "", trim: true, lowercase: true, maxlength: 254 },
      templates: {
        orderCreated: { type: templateSchema, default: () => ({}) },
        orderStatusChanged: { type: templateSchema, default: () => ({}) },
        newUser: { type: templateSchema, default: () => ({}) },
        contactForm: { type: templateSchema, default: () => ({}) },
        newsletter: { type: templateSchema, default: () => ({}) },
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Settings || mongoose.model("Settings", settingsSchema);
