const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");
const { handleImageUpload, storeImage } = require("../services/uploadService");

const router = express.Router();

// POST /api/upload?folder=products|categories  (admin only, multipart field "image")
router.post("/", authMiddleware, adminMiddleware, handleImageUpload, async (req, res) => {
  try {
    const stored = await storeImage(req.file, String(req.query.folder || req.body?.folder || "products"));

    return res.json({
      success: true,
      message: "Image uploaded successfully",
      url: stored.url,
      filename: stored.filename,
      storage: stored.storage,
      size: req.file.size,
    });
  } catch (error) {
    if (!error.status) console.error("Image upload failed:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : "Image upload failed. Please try again.",
    });
  }
});

module.exports = router;
