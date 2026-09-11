const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { Readable } = require("stream");

/*
 * Image upload service shared by products and categories.
 *
 * Storage drivers (UPLOAD_STORAGE env):
 *   local       → files saved in backend/uploads/<folder>/ and served by Express at /uploads/<folder>/<file>
 *   cloudinary  → files uploaded to Cloudinary (persistent; needed on Vercel/serverless hosts)
 * Default: "local", except on Vercel where the filesystem is read-only — there Cloudinary is used
 * automatically when its credentials exist.
 *
 * Every driver returns the same shape: { url, filename, storage }, so the rest of the app never
 * cares where the file lives. Switching to S3 or another provider later only means adding a driver.
 */

const UPLOAD_ROOT = path.join(__dirname, "..", "uploads");
const PUBLIC_PREFIX = "/uploads";
const ALLOWED_FOLDERS = ["products", "categories"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed image types, with their file signatures ("magic bytes").
const IMAGE_TYPES = {
  "image/jpeg": { ext: "jpg", test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/png": { ext: "png", test: (b) => b.length > 8 && b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/gif": { ext: "gif", test: (b) => b.length > 6 && ["GIF87a", "GIF89a"].includes(b.slice(0, 6).toString("ascii")) },
  "image/webp": { ext: "webp", test: (b) => b.length > 12 && b.slice(0, 4).toString("ascii") === "RIFF" && b.slice(8, 12).toString("ascii") === "WEBP" },
};

class UploadError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "UploadError";
    this.status = status;
  }
}

const isCloudinaryConfigured = () =>
  Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

const isReadOnlyHost = () => Boolean(process.env.VERCEL);

const getStorageDriver = () => {
  const configured = String(process.env.UPLOAD_STORAGE || "").trim().toLowerCase();
  if (configured === "local" || configured === "cloudinary") return configured;
  if (isReadOnlyHost() && isCloudinaryConfigured()) return "cloudinary";
  return "local";
};

/** Multer middleware: memory storage + type/size limits. */
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (req, file, cb) => {
    if (IMAGE_TYPES[file.mimetype]) return cb(null, true);
    return cb(new UploadError("Only JPG, PNG, WEBP or GIF images are allowed."));
  },
}).single("image");

/** Wraps multer so its errors become friendly JSON responses. */
const handleImageUpload = (req, res, next) =>
  imageUpload(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ success: false, message: "Image is too large. Maximum size is 5MB." });
    }
    return res.status(error.status || 400).json({ success: false, message: error.message || "Invalid image upload." });
  });

const resolveFolder = (folder) => (ALLOWED_FOLDERS.includes(folder) ? folder : "products");

const validateImage = (file) => {
  if (!file || !file.buffer || !file.buffer.length) {
    throw new UploadError("No image file was received.");
  }
  const type = IMAGE_TYPES[file.mimetype];
  if (!type || !type.test(file.buffer)) {
    throw new UploadError("The file does not look like a valid image.");
  }
  return type;
};

const saveLocally = async (file, folder, ext) => {
  if (isReadOnlyHost()) {
    throw new UploadError(
      "This server runs on Vercel, whose filesystem is read-only, so images cannot be saved locally. " +
        "Add Cloudinary credentials (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) " +
        "to the backend environment, or paste an image URL instead.",
      503
    );
  }

  const directory = path.join(UPLOAD_ROOT, folder);
  await fs.promises.mkdir(directory, { recursive: true });

  const prefix = folder === "categories" ? "cat" : "prod";
  const filename = `${prefix}-${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  await fs.promises.writeFile(path.join(directory, filename), file.buffer);

  return { url: `${PUBLIC_PREFIX}/${folder}/${filename}`, filename, storage: "local" };
};

const saveToCloudinary = async (file, folder) => {
  if (!isCloudinaryConfigured()) {
    throw new UploadError("Cloudinary storage is selected but its credentials are missing on the server.", 500);
  }

  // Loaded lazily so local development never needs Cloudinary configured.
  const { v2: cloudinary } = require("cloudinary");
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `e-commerce/${folder}`, resource_type: "image" },
      (error, uploaded) => (error ? reject(error) : resolve(uploaded))
    );
    Readable.from(file.buffer).pipe(stream);
  });

  return { url: result.secure_url, filename: result.public_id, storage: "cloudinary" };
};

/** Validates and stores an uploaded image. Returns { url, filename, storage }. */
const storeImage = async (file, folderName) => {
  const type = validateImage(file);
  const folder = resolveFolder(folderName);

  if (getStorageDriver() === "cloudinary") {
    try {
      return await saveToCloudinary(file, folder);
    } catch (error) {
      if (error instanceof UploadError) throw error;
      console.error("Cloudinary upload failed:", error.message);
      throw new UploadError("Image storage upload failed. Please try again.", 502);
    }
  }

  return saveLocally(file, folder, type.ext);
};

module.exports = {
  UPLOAD_ROOT,
  PUBLIC_PREFIX,
  UploadError,
  handleImageUpload,
  storeImage,
  getStorageDriver,
};
