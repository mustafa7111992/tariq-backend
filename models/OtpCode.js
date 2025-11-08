// models/OtpCode.js
const mongoose = require('mongoose');

const otpCodeSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true },
    code: { type: String, required: true },
    // نخليه ينتهي بعد 5 دقايق
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// index عالانتهاء
otpCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('OtpCode', otpCodeSchema);