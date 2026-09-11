const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
      index: true,
    },

    resetPasswordToken: {
      type: String,
      default: null,
    },

    resetPasswordExpires: {
      type: Date,
      default: null,
    },

    // Admin created from ADMIN_USERNAME / ADMIN_PASSWORD on first admin login.
    isPrimaryAdmin: {
      type: Boolean,
      default: false,
    },

    // True once an admin has set their own email/password in Admin → Settings.
    // From then on the admin signs in with the database credentials, not the .env ones.
    adminCredentialsManaged: {
      type: Boolean,
      default: false,
    },

    // Tokens issued before this moment are rejected (set when an admin changes password).
    passwordChangedAt: {
      type: Date,
      default: null,
    },

    address: {
      street: { type: String, default: "" },
      city: { type: String, default: "" },
      postalCode: { type: String, default: "" },
      phone: { type: String, default: "" },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);