// models/OtpCode.js
const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true, index: true },
    code: { type: String, required: true },
    // نخلي TTL بهالشكل 👇
    expiresAt: {
      type: Date,
      required: true,
      expires: 0, // يعني احذف الوثيقة لما يوصل هذا التاريخ
    },
    role: { type: String, default: 'customer' },
    purpose: { type: String, default: 'login' },
    attempts: { type: Number, default: 0 },
  },
  {
    timestamps: true, // حتى نستخدم updatedAt للـ rate limit
  }
);

module.exports = mongoose.model('OtpCode', otpSchema);