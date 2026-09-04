const express = require("express");
const Order = require("../models/Order");
const User = require("../models/User");

const router = express.Router();
const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role || "user",
  createdAt: user.createdAt,
});

router.get("/overview", async (req, res) => {
  try {
    const [totalUsers, totalOrders, pendingOrders, completedOrders, earnings] = await Promise.all([
      User.countDocuments(),
      Order.countDocuments(),
      Order.countDocuments({ orderStatus: { $in: ["pending", "processing"] } }),
      Order.countDocuments({ orderStatus: "delivered" }),
      Order.aggregate([
        { $match: { paymentStatus: "paid" } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
    ]);

    return res.json({
      success: true,
      stats: {
        totalUsers,
        totalOrders,
        pendingOrders,
        completedOrders,
        totalEarnings: earnings[0]?.total || 0,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable to load admin overview" });
  }
});

router.get("/users", async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();
    const filter = search
      ? { $or: [{ name: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }] }
      : {};
    const users = await User.find(filter).select("-password -resetPasswordToken -resetPasswordExpires").sort({ createdAt: -1 });
    return res.json({ success: true, users: users.map(publicUser) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable to load users" });
  }
});

router.get("/orders", async (req, res) => {
  try {
    const orders = await Order.find().populate("userId", "name email").sort({ createdAt: -1 });
    return res.json({ success: true, orders });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable to load orders" });
  }
});

router.patch("/orders/:orderId/status", async (req, res) => {
  const allowedStatuses = ["pending", "processing", "shipped", "delivered", "cancelled"];
  const orderStatus = String(req.body.orderStatus || "").toLowerCase();

  if (!allowedStatuses.includes(orderStatus)) {
    return res.status(400).json({ success: false, message: "Invalid order status" });
  }

  try {
    const order = await Order.findByIdAndUpdate(req.params.orderId, { orderStatus }, { new: true });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    return res.json({ success: true, order });
  } catch (error) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }
});

module.exports = router;