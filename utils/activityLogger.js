// utils/activityLogger.js
const ActivityLog = require("../models/ActivityLog");

async function logActivity(req, action, metadata = {}) {
  try {
    await ActivityLog.create({
      action,
      userPhone: req.body.phone || req.query.phone,
      userId: req.body.userId,
      requestId: req.params.id,
      metadata,
      ip: req.ip || req.headers["x-forwarded-for"],
      userAgent: req.headers["user-agent"],
    });
  } catch (err) {
    console.error("❌ failed to log activity", err.message);
  }
}

module.exports = { logActivity };