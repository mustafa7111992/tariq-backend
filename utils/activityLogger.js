// utils/activityLogger.js
const ActivityLog = require('../models/ActivityLog');

async function logActivity(action, req, metadata = {}) {
  try {
    await ActivityLog.create({
      action,
      userPhone: req.body.phone || req.query.phone,
      userId: req.body.userId,
      requestId: req.params.id,
      metadata,
      ip: req.ip || req.headers['x-forwarded-for'],
      userAgent: req.headers['user-agent'],
    });
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
}

module.exports = { logActivity };