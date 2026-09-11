const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { templateCatalog } = require("../templates");
const {
  getSettings,
  updateSettings,
  SettingsValidationError,
} = require("../services/settingsService");
const { isEmailConfigured, getAdminRecipient } = require("../services/emailService");
const { getStorageDriver } = require("../services/uploadService");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const adminProfile = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  isPrimaryAdmin: Boolean(user.isPrimaryAdmin),
  credentialsManaged: Boolean(user.adminCredentialsManaged),
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const settingsResponse = async (settings, user) => ({
  shipping: settings.shipping,
  emails: {
    storeName: settings.emails?.storeName || "Aura",
    adminEmail: settings.emails?.adminEmail || "",
    templates: settings.emails?.templates || {},
  },
  templateCatalog: templateCatalog(),
  // Read-only status flags — never the secrets themselves.
  system: {
    emailConfigured: isEmailConfigured(),
    notificationRecipient: await getAdminRecipient(settings),
    uploadStorage: getStorageDriver(),
  },
  profile: user ? adminProfile(user) : null,
  updatedAt: settings.updatedAt,
});

// GET /api/admin/settings
const getAdminSettings = async (req, res) => {
  try {
    const [settings, user] = await Promise.all([getSettings(), User.findById(req.userId)]);
    return res.json({ success: true, settings: await settingsResponse(settings, user) });
  } catch (error) {
    console.error("Admin settings load error:", error);
    return res.status(500).json({ success: false, message: "Unable to load settings" });
  }
};

// PUT /api/admin/settings  { shipping?, emails? }
const updateAdminSettings = async (req, res) => {
  try {
    const settings = await updateSettings(req.body || {});
    const user = await User.findById(req.userId);
    return res.json({
      success: true,
      message: "Settings saved",
      settings: await settingsResponse(settings, user),
    });
  } catch (error) {
    if (error instanceof SettingsValidationError) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("Admin settings update error:", error);
    return res.status(500).json({ success: false, message: "Unable to save settings" });
  }
};

// PUT /api/admin/profile  { name, email, currentPassword, newPassword }
const updateAdminProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Administrator access required" });
    }

    const name = String(req.body?.name ?? user.name).trim();
    const email = String(req.body?.email ?? user.email).trim().toLowerCase();
    const currentPassword = String(req.body?.currentPassword || "");
    const newPassword = String(req.body?.newPassword || "");

    if (!name || name.length > 80) {
      return res.status(400).json({ success: false, message: "Display name is required (80 characters max)." });
    }
    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ success: false, message: "Please enter a valid email address." });
    }

    const emailChanged = email !== user.email;
    const passwordChanged = newPassword.length > 0;

    if (passwordChanged && (newPassword.length < 8 || newPassword.length > 128)) {
      return res.status(400).json({ success: false, message: "New password must be between 8 and 128 characters." });
    }

    if (emailChanged || passwordChanged) {
      if (!currentPassword) {
        return res.status(400).json({ success: false, message: "Enter your current password to change your email or password." });
      }

      // The primary admin may still be using the ADMIN_PASSWORD from .env.
      const matchesStored = await bcrypt.compare(currentPassword, user.password);
      const matchesBootstrap =
        user.isPrimaryAdmin &&
        !user.adminCredentialsManaged &&
        currentPassword === String(process.env.ADMIN_PASSWORD || "admin");

      if (!matchesStored && !matchesBootstrap) {
        return res.status(401).json({ success: false, message: "Current password is incorrect." });
      }
    }

    if (emailChanged) {
      const taken = await User.findOne({ email, _id: { $ne: user._id } }).select("_id").lean();
      if (taken) {
        return res.status(409).json({ success: false, message: "Another account already uses this email." });
      }
    }

    user.name = name;
    user.email = email;

    if (emailChanged || passwordChanged) {
      user.adminCredentialsManaged = true;
    }

    if (passwordChanged) {
      if (await bcrypt.compare(newPassword, user.password)) {
        return res.status(400).json({ success: false, message: "New password must be different from the current one." });
      }
      user.password = await bcrypt.hash(newPassword, 10);
      user.passwordChangedAt = new Date();
    } else if (emailChanged && !(await bcrypt.compare(currentPassword, user.password))) {
      // Bootstrap admin changing only the email: store the verified password as a proper hash.
      user.password = await bcrypt.hash(currentPassword, 10);
    }

    await user.save();

    // A password change invalidates older tokens, so hand back a fresh one for this session.
    const token = passwordChanged
      ? jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" })
      : undefined;

    return res.json({
      success: true,
      message: passwordChanged
        ? "Profile and password updated. Other signed-in sessions have been signed out."
        : "Profile updated",
      profile: adminProfile(user),
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
      token,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, message: "Another account already uses this email." });
    }
    console.error("Admin profile update error:", error);
    return res.status(500).json({ success: false, message: "Unable to update profile" });
  }
};

module.exports = { getAdminSettings, updateAdminSettings, updateAdminProfile };
