const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Connect MongoDB
connectDB();

// Test route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Backend API is running",
  });
});

// Auth routes
const authRoutes = require("./routes/authRoutes");

app.use("/api/auth", authRoutes);

// Local development
const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;