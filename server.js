const express = require("express");
const cors = require("cors");
const path = require("path");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const databaseMiddleware = require("./middleware/databaseMiddleware");
const seedCatalog = require("./config/seedCatalog");

dotenv.config();

const app = express();

const allowedOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Origin is not allowed by CORS"));
  },
}));
app.use(express.json());

// Serve uploaded images: /uploads/products/..., /uploads/categories/... (and older /uploads/<file>)
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    maxAge: "7d",
    fallthrough: true,
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  })
);

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({
      success: false,
      message: "Request body must be valid JSON",
    });
  }

  return next(error);
});

// Connect MongoDB and trigger catalog seeder
connectDB()
  .then(() => seedCatalog())
  .catch((error) => {
    console.error("MongoDB startup error:", error.message);
  });

// Test route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Backend API is running",
  });
});

// Routes
const authRoutes = require("./routes/authRoutes");
const stripeRoutes = require("./routes/stripeRoutes");
const orderRoutes = require("./routes/orderRoutes");
const productRoutes = require("./routes/productRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const authMiddleware = require("./middleware/authMiddleware");
const adminMiddleware = require("./middleware/adminMiddleware");
const adminRoutes = require("./routes/adminRoutes");
const subscriberRoutes = require("./routes/subscriberRoutes");
 
const contactRoutes = require("./routes/contactRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
 

app.use("/api/auth", databaseMiddleware);
app.use("/api/auth", authRoutes);
app.use("/api", stripeRoutes);
app.use("/api/orders", authMiddleware, orderRoutes);
app.use("/api/products", databaseMiddleware, productRoutes);
app.use("/api/categories", databaseMiddleware, categoryRoutes);
app.use("/api/upload", databaseMiddleware, uploadRoutes);
app.use("/api/subscribers", databaseMiddleware, subscriberRoutes);
 
app.use("/api/admin", authMiddleware, adminMiddleware, adminRoutes);
 
app.use("/api/contact", databaseMiddleware, contactRoutes);
app.use("/api/settings", databaseMiddleware, settingsRoutes);
app.use("/api/admin", databaseMiddleware, authMiddleware, adminMiddleware, adminRoutes);
 
// Local development
const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;