const connectDB = require("../config/db");

const databaseMiddleware = async (req, res, next) => {
  try {
    await connectDB();
    return next();
  } catch (error) {
    return res.status(503).json({
      success: false,
      message: "Database is currently unavailable",
    });
  }
};

module.exports = databaseMiddleware;