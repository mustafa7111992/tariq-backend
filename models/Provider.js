// models/Provider.js
const mongoose = require('mongoose');

// نوحّد الرقم مثل باقي السيستم
function normalizePhone(raw) {
  if (!raw) return null;
  const p = raw.trim().replace(/\s+/g, '');
  if (p.startsWith('07')) return `+964${p.slice(1)}`;
  if (p.startsWith('+')) return /^\+[0-9]+$/.test(p) ? p : null;
  return /^[0-9]+$/.test(p) ? p : null;
}

const providerSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
      set: normalizePhone, // يخزن الرقم موحد
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // نوع الخدمة اللي يقدمها (نجار، كهربائي، سطحة...)
    serviceType: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    // هل هو مفعل
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    // توثيق/تحقق المزود (تريد تربطه بأدمن بعدين)
    isVerified: {
      type: Boolean,
      default: false,
    },
    // للتنبيهات
    fcmToken: {
      type: String,
      default: null,
    },
    // إحصائيات بسيطة
    totalRequests: {
      type: Number,
      default: 0,
    },
    lastRequestAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
providerSchema.index({ phone: 1 });
providerSchema.index({ serviceType: 1, city: 1 });
providerSchema.index({ createdAt: -1 });

// method مثل الكستمر
providerSchema.methods.incrementRequests = function () {
  this.totalRequests += 1;
  this.lastRequestAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Provider', providerSchema);