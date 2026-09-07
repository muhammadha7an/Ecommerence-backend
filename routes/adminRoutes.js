const express = require("express");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const User = require("../models/User");
const Product = require("../models/Product");
const Category = require("../models/Category");

const router = express.Router();

const publicUser = (user, orderStats = {}) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role || "user",
  address: user.address || {},
  createdAt: user.createdAt,
  orderCount: orderStats.orderCount || 0,
  totalSpent: orderStats.totalSpent || 0,
});

// GET /api/admin/overview
router.get("/overview", async (req, res) => {
  try {
    const [
      totalUsers,
      totalOrders,
      pendingOrders,
      completedOrders,
      earnings,
      totalProducts,
      totalCategories,
      lowStockCount,
    ] = await Promise.all([
      User.countDocuments(),
      Order.countDocuments(),
      Order.countDocuments({ orderStatus: { $in: ["pending", "processing"] } }),
      Order.countDocuments({ orderStatus: "delivered" }),
      Order.aggregate([
        { $match: { paymentStatus: "paid" } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
      Product.countDocuments(),
      Category.countDocuments(),
      Product.countDocuments({ stock: { $lte: 5 } }),
    ]);

    return res.json({
      success: true,
      stats: {
        totalUsers,
        totalOrders,
        pendingOrders,
        completedOrders,
        totalEarnings: earnings[0]?.total || 0,
        totalProducts,
        totalCategories,
        lowStockCount,
      },
    });
  } catch (error) {
    console.error("Admin overview error:", error);
    return res.status(500).json({ success: false, message: "Unable to load admin overview" });
  }
});

// GET /api/admin/analytics - real database aggregation for dynamic charts
router.get("/analytics", async (req, res) => {
  try {
    // 1. Orders and revenue by status
    const statusBreakdown = await Order.aggregate([
      {
        $group: {
          _id: "$orderStatus",
          count: { $sum: 1 },
          revenue: { $sum: "$totalAmount" },
        },
      },
    ]);

    // 2. Sales over time (last 6 months or all orders grouped by month/year)
    const salesOverTime = await Order.aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          orderCount: { $sum: 1 },
          totalRevenue: { $sum: "$totalAmount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
      { $limit: 12 },
    ]);

    // Format months for chart display
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const formattedTimeline = salesOverTime.map((item) => ({
      period: `${monthNames[item._id.month - 1]} ${item._id.year}`,
      orders: item.orderCount,
      revenue: Math.round((item.totalRevenue || 0) / 100), // in dollars
    }));

    // 3. Products by category distribution
    const productsByCategory = await Product.aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    return res.json({
      success: true,
      analytics: {
        statusBreakdown: statusBreakdown.map((s) => ({
          status: s._id || "pending",
          count: s.count,
          revenue: s.revenue / 100,
        })),
        timeline: formattedTimeline,
        productsByCategory: productsByCategory.map((c) => ({
          category: c._id || "Uncategorized",
          count: c.count,
        })),
      },
    });
  } catch (error) {
    console.error("Admin analytics error:", error);
    return res.status(500).json({ success: false, message: "Unable to load analytics" });
  }
});

// GET /api/admin/daily-earnings?days=7
router.get("/daily-earnings", async (req, res) => {
  try {
    const days = Math.min(
      Math.max(parseInt(req.query.days, 10) || 7, 1),
      30
    );

    const startDate = new Date();

    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - (days - 1));

    const dailyEarnings = await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startDate,
          },
          paymentStatus: "paid",
        },
      },

      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "Asia/Karachi",
            },
          },

          totalRevenue: {
            $sum: "$totalAmount",
          },

          orderCount: {
            $sum: 1,
          },
        },
      },

      {
        $sort: {
          _id: 1,
        },
      },
    ]);

    const earningsMap = {};

    dailyEarnings.forEach((item) => {
      earningsMap[item._id] = {
        total: (item.totalRevenue || 0) / 100,
        orderCount: item.orderCount || 0,
      };
    });

    const result = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();

      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - i);

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");

      const dateKey = `${year}-${month}-${day}`;

      result.push({
        date: dateKey,
        total: earningsMap[dateKey]?.total || 0,
        orderCount: earningsMap[dateKey]?.orderCount || 0,
      });
    }

    return res.json({
      success: true,
      days,
      earnings: result,
    });
  } catch (error) {
    console.error("Daily earnings error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load daily earnings",
    });
  }
});

// GET /api/admin/daily-earnings?days=7
router.get("/daily-earnings", async (req, res) => {
  try {
    const days = Math.min(
      Math.max(parseInt(req.query.days, 10) || 7, 1),
      30
    );

    const startDate = new Date();

    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - (days - 1));

    const dailyEarnings = await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startDate,
          },
          paymentStatus: "paid",
        },
      },

      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "Asia/Karachi",
            },
          },

          totalRevenue: {
            $sum: "$totalAmount",
          },

          orderCount: {
            $sum: 1,
          },
        },
      },

      {
        $sort: {
          _id: 1,
        },
      },
    ]);

    const earningsMap = {};

    dailyEarnings.forEach((item) => {
      earningsMap[item._id] = {
        total: (item.totalRevenue || 0) / 100,
        orderCount: item.orderCount || 0,
      };
    });

    const result = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();

      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - i);

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");

      const dateKey = `${year}-${month}-${day}`;

      result.push({
        date: dateKey,
        total: earningsMap[dateKey]?.total || 0,
        orderCount: earningsMap[dateKey]?.orderCount || 0,
      });
    }

    return res.json({
      success: true,
      days,
      earnings: result,
    });
  } catch (error) {
    console.error("Daily earnings error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load daily earnings",
    });
  }
});


// GET /api/admin/users
router.get("/users", async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();
    const filter = search
      ? { $or: [{ name: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }] }
      : {};

    const users = await User.find(filter)
      .select("-password -resetPasswordToken -resetPasswordExpires")
      .sort({ createdAt: -1 });

    // Aggregate user order statistics
    const userOrderStats = await Order.aggregate([
      {
        $group: {
          _id: "$userId",
          orderCount: { $sum: 1 },
          totalSpent: { $sum: "$totalAmount" },
        },
      },
    ]);

    const statsMap = {};
    userOrderStats.forEach((s) => {
      if (s._id) {
        statsMap[s._id.toString()] = {
          orderCount: s.orderCount,
          totalSpent: (s.totalSpent || 0) / 100,
        };
      }
    });

    return res.json({
      success: true,
      users: users.map((u) => publicUser(u, statsMap[u._id.toString()] || {})),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable to load users" });
  }
});

// PATCH /api/admin/users/:userId/role - update user role
router.patch("/users/:userId/role", async (req, res) => {
  try {
    const { role } = req.body;
    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({ success: false, message: "Role must be 'user' or 'admin'" });
    }

    if (String(req.userId) === String(req.params.userId) && role !== "admin") {
      return res.status(400).json({ success: false, message: "You cannot revoke your own administrator role" });
    }

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { role },
      { new: true }
    ).select("-password -resetPasswordToken -resetPasswordExpires");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({ success: true, message: `User role changed to ${role}`, user: publicUser(user) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable to update user role" });
  }
});

// DELETE /api/admin/users/:userId - delete user
router.delete("/users/:userId", async (req, res) => {
  try {
    if (String(req.userId) === String(req.params.userId)) {
      return res.status(400).json({ success: false, message: "You cannot delete your own account" });
    }

    const user = await User.findByIdAndDelete(req.params.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable to delete user" });
  }
});

// GET /api/admin/orders
router.get("/orders", async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "").trim();

    let query = {};
    if (status && status !== "all") {
      query.orderStatus = status;
    }

    const orders = await Order.find(query)
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

    let filtered = orders;
    if (search) {
      const s = search.toLowerCase();
      filtered = orders.filter((o) => {
        const idMatch = String(o._id).toLowerCase().includes(s);
        const nameMatch = o.userId?.name?.toLowerCase().includes(s);
        const emailMatch = o.userId?.email?.toLowerCase().includes(s);
        const shippingName = o.shippingDetails?.fullName?.toLowerCase().includes(s);
        return idMatch || nameMatch || emailMatch || shippingName;
      });
    }

    return res.json({ success: true, count: filtered.length, orders: filtered });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable to load orders" });
  }
});

// GET /api/admin/orders/:orderId
router.get("/orders/:orderId", async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId).populate("userId", "name email");
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    return res.json({ success: true, order });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable to load order" });
  }
});

// PATCH /api/admin/orders/:orderId/status
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
    return res.status(500).json({ success: false, message: "Unable to update order" });
  }
});

module.exports = router;