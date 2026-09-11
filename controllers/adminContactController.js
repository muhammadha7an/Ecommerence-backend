const mongoose = require("mongoose");
const ContactSubmission = require("../models/ContactSubmission");

const STATUSES = ["new", "read", "resolved"];
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET /api/admin/contact-messages?status=new|read|resolved|all&search=
const listContactMessages = async (req, res) => {
  try {
    const status = String(req.query.status || "all").toLowerCase();
    const search = String(req.query.search || "").trim().slice(0, 100);

    const query = {};
    if (STATUSES.includes(status)) query.status = status;
    if (search) {
      const pattern = new RegExp(escapeRegex(search), "i");
      query.$or = [{ name: pattern }, { email: pattern }, { subject: pattern }, { message: pattern }];
    }

    const [messages, counts] = await Promise.all([
      ContactSubmission.find(query).sort({ createdAt: -1 }).limit(500).lean(),
      ContactSubmission.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    ]);

    const summary = { total: 0, new: 0, read: 0, resolved: 0 };
    counts.forEach((row) => {
      if (STATUSES.includes(row._id)) summary[row._id] = row.count;
      summary.total += row.count;
    });

    return res.json({ success: true, messages, summary });
  } catch (error) {
    console.error("Contact messages load error:", error);
    return res.status(500).json({ success: false, message: "Unable to load contact messages" });
  }
};

// PATCH /api/admin/contact-messages/:id  { status }
const updateContactMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const status = String(req.body?.status || "").toLowerCase();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid message id" });
    }
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: "Status must be new, read or resolved" });
    }

    const update = { status };
    if (status === "new") Object.assign(update, { readAt: null, resolvedAt: null });
    if (status === "read") Object.assign(update, { readAt: new Date(), resolvedAt: null });
    if (status === "resolved") Object.assign(update, { resolvedAt: new Date() });

    const message = await ContactSubmission.findByIdAndUpdate(id, update, { new: true });
    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }
    if (status === "resolved" && !message.readAt) {
      message.readAt = message.resolvedAt;
      await message.save();
    }

    return res.json({ success: true, message: "Message updated", contactMessage: message });
  } catch (error) {
    console.error("Contact message update error:", error);
    return res.status(500).json({ success: false, message: "Unable to update message" });
  }
};

// DELETE /api/admin/contact-messages/:id
const deleteContactMessage = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid message id" });
    }
    const deleted = await ContactSubmission.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }
    return res.json({ success: true, message: "Message deleted", id });
  } catch (error) {
    console.error("Contact message delete error:", error);
    return res.status(500).json({ success: false, message: "Unable to delete message" });
  }
};

module.exports = { listContactMessages, updateContactMessage, deleteContactMessage };
