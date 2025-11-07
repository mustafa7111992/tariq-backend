// models/ActivityLog.js
const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema(
  {
    action: String,
    userId: String,
    userPhone: String,
    requestId: mongoose.Schema.Types.ObjectId,
    metadata: mongoose.Schema.Types.Mixed,
    ip: String,
    userAgent: String,
  },
  { timestamps: true }
);

activityLogSchema.index({ userPhone: 1, createdAt: -1 });
activityLogSchema.index({ requestId: 1 });

module.exports = mongoose.model("ActivityLog", activityLogSchema);