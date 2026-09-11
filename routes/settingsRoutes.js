const express = require("express");
const { getSettings, publicSettings } = require("../services/settingsService");

const router = express.Router();

// GET /api/settings/public — storefront-safe settings (shipping rules, store name)
router.get("/public", async (req, res) => {
  try {
    const settings = await getSettings();
    res.set("Cache-Control", "no-store");
    return res.json({ success: true, settings: publicSettings(settings) });
  } catch (error) {
    console.error("Public settings error:", error);
    return res.status(500).json({ success: false, message: "Unable to load store settings" });
  }
});

module.exports = router;
