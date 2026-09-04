const adminMiddleware = (req, res, next) => {
  if (req.userRole !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Administrator access required",
    });
  }

  next();
};

module.exports = adminMiddleware;