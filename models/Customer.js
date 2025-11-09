// models/Customer.js
const mongoose = require('mongoose');

// 🔹 توحيد رقم الهاتف داخل الموديل
function normalizePhone(raw) {
  if (!raw) return null;
  const p = raw.trim().replace(/\s+/g, '');
  if (p.startsWith('07')) return `+964${p.slice(1)}`;
  if (p.startsWith('+')) return /^\+[0-9]+$/.test(p) ? p : null;
  return /^[0-9]+$/.test(p) ? p : null;
}

const customerSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
      set: normalizePhone, // 👈 تلقائياً يوحّد الرقم عند الحفظ
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    avatar: {
      type: String,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // 🔹 مكان أو عنوان الزبون (اختياري)
    location: {
      type: {
        lat: Number,
        lng: Number,
        address: String,
      },
      default: null,
    },
    // 🔹 للتنبيهات عبر FCM مثلاً
    fcmToken: {
      type: String,
      default: null,
    },
    // 🔹 إحصائيات الطلبات
    lastRequestAt: Date,
    totalRequests: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// ============================================================================
// Indexes
// ============================================================================
customerSchema.index({ phone: 1 });
customerSchema.index({ createdAt: -1 });

// ============================================================================
// Methods
// ============================================================================
customerSchema.methods.incrementRequests = function () {
  this.totalRequests += 1;
  this.lastRequestAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Customer', customerSchema);