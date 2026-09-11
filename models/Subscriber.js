const mongoose = require("mongoose");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const subscriberSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email address is required"],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: [EMAIL_PATTERN, "Please enter a valid email address"],
    },
    status: {
      type: String,
      enum: ["active", "unsubscribed"],
      default: "active",
    },
    source: {
      type: String,
      enum: ["home", "footer", "website"],
      default: "website",
    },
  },
  { timestamps: true }
);

subscriberSchema.index({ createdAt: -1 });

module.exports =
  mongoose.models.Subscriber || mongoose.model("Subscriber", subscriberSchema);
module.exports.EMAIL_PATTERN = EMAIL_PATTERN;
