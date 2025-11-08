// models/OtpCode.js
const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true, index: true },
    code: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } }, // TTL index
    role: { type: String, default: 'customer' },
    purpose: { type: String, default: 'login' },
    attempts: { type: Number, default: 0 },
  },
  {
    timestamps: true, // 👈 هذا اللي يخلي updatedAt موجود
  }
);

module.exports = mongoose.model('OtpCode', otpSchema);