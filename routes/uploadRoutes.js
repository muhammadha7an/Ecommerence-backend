const express = require("express");
const multer = require("multer");
const { Readable } = require("stream");
const { v2: cloudinary } = require("cloudinary");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp|svg\+xml|svg|gif/;
  const mimeMatch = allowedTypes.test(file.mimetype);
  const extMatch = allowedTypes.test(file.originalname.toLowerCase().split(".").pop());

  if (mimeMatch || extMatch) {
    return cb(null, true);
  }
  return cb(new Error("Only image files (jpeg, jpg, png, webp, svg, gif) are allowed"), false);
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter,
});

const uploadToCloudinary = (buffer) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "e-commerce/products",
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(result);
      }
    );

    Readable.from(buffer).pipe(stream);
  });

router.post("/", authMiddleware, adminMiddleware, upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "No image file provided or invalid file format",
    });
  }

  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return res.status(500).json({
        success: false,
        message: "Image storage is not configured on the server.",
      });
    }

    const result = await uploadToCloudinary(req.file.buffer);

    return res.json({
      success: true,
      message: "Image uploaded successfully",
      url: result.secure_url,
      filename: result.public_id,
      size: req.file.size,
    });
  } catch (error) {
    console.error("Cloudinary image upload failed:", error.message);
    return res.status(502).json({
      success: false,
      message: "Image storage upload failed. Please try again.",
    });
  }
});

module.exports = router;

