// models/OtpCode.js
const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema(
  {
    // رقم الهاتف (مع مفتاح الدولة)
    phone: {
      type: String,
      required: true,
      index: true, // ✅ بدون unique حتى نقدر نرسل أكثر من مرة
      trim: true,
    },

    // رمز التحقق (6 أرقام)
    code: {
      type: String,
      required: true,
      minlength: 4,
      maxlength: 6,
    },

    // تاريخ انتهاء الصلاحية
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    // دور المستخدم
    role: {
      type: String,
      enum: ['customer', 'provider', 'admin'],
      default: 'customer',
    },

    // الغرض من الكود
    purpose: {
      type: String,
      enum: ['login', 'register', 'reset_password'],
      default: 'login',
    },

    // عدد المحاولات الفاشلة
    attempts: {
      type: Number,
      default: 0,
      max: 5, // ✅ حد أقصى 5 محاولات
    },

    // حالة الكود
    status: {
      type: String,
      enum: ['pending', 'verified', 'expired', 'blocked'],
      default: 'pending',
    },

    // 👇 البيانات المؤقتة للتسجيل الجديد (هذا المفقود!)
    pendingData: {
      name: {
        type: String,
        trim: true,
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
      },
      // يمكن إضافة بيانات أخرى حسب الحاجة
    },

    // IP Address (للأمان)
    ipAddress: {
      type: String,
    },

    // User Agent (للأمان)
    userAgent: {
      type: String,
    },

    // تاريخ آخر محاولة تحقق
    lastAttemptAt: {
      type: Date,
    },

    // تاريخ التحقق الناجح
    verifiedAt: {
      type: Date,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// ============================================================================
// TTL Index - حذف تلقائي بعد انتهاء الصلاحية
// ============================================================================
otpSchema.index(
  { expiresAt: 1 },
  { 
    expireAfterSeconds: 0,
    // هذا يعني: احذف الوثيقة بعد ما يوصل expiresAt
  }
);

// ============================================================================
// Compound Index - للبحث السريع
// ============================================================================
otpSchema.index({ phone: 1, status: 1 });
otpSchema.index({ phone: 1, createdAt: -1 });

// ============================================================================
// Virtual - هل الكود منتهي؟
// ============================================================================
otpSchema.virtual('isExpired').get(function () {
  return this.expiresAt < new Date();
});

// ============================================================================
// Virtual - الوقت المتبقي بالثواني
// ============================================================================
otpSchema.virtual('remainingSeconds').get(function () {
  const diff = this.expiresAt - new Date();
  return diff > 0 ? Math.floor(diff / 1000) : 0;
});

// ============================================================================
// Instance Method - زيادة عدد المحاولات
// ============================================================================
otpSchema.methods.incrementAttempts = async function () {
  this.attempts += 1;
  this.lastAttemptAt = new Date();

  // إذا وصل 5 محاولات، حظره
  if (this.attempts >= 5) {
    this.status = 'blocked';
  }

  await this.save();
  return this.attempts;
};

// ============================================================================
// Instance Method - تحقق من الكود
// ============================================================================
otpSchema.methods.verify = async function (inputCode) {
  // تحقق من الحالة
  if (this.status === 'blocked') {
    throw new Error('الكود محظور بسبب كثرة المحاولات الخاطئة');
  }

  if (this.status === 'verified') {
    throw new Error('الكود مستخدم مسبقاً');
  }

  if (this.isExpired) {
    this.status = 'expired';
    await this.save();
    throw new Error('الكود منتهي الصلاحية');
  }

  // تحقق من الكود
  if (this.code !== inputCode) {
    await this.incrementAttempts();
    const remaining = 5 - this.attempts;
    throw new Error(`كود خاطئ. المحاولات المتبقية: ${remaining}`);
  }

  // نجح التحقق
  this.status = 'verified';
  this.verifiedAt = new Date();
  await this.save();

  return true;
};

// ============================================================================
// Static Method - إنشاء OTP جديد
// ============================================================================
otpSchema.statics.createOTP = async function ({
  phone,
  code,
  role = 'customer',
  purpose = 'login',
  pendingData = {},
  ipAddress = null,
  userAgent = null,
  expiryMinutes = 5,
}) {
  // حذف أي أكواد قديمة لنفس الرقم
  await this.deleteMany({ 
    phone, 
    status: { $in: ['pending', 'expired'] } 
  });

  // إنشاء OTP جديد
  const otp = await this.create({
    phone,
    code,
    role,
    purpose,
    pendingData,
    ipAddress,
    userAgent,
    expiresAt: new Date(Date.now() + expiryMinutes * 60 * 1000),
  });

  return otp;
};

// ============================================================================
// Static Method - البحث عن OTP صالح
// ============================================================================
otpSchema.statics.findValidOTP = async function (phone) {
  return await this.findOne({
    phone,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });
};

// ============================================================================
// Pre-save Hook - تحويل الكود لـ uppercase (اختياري)
// ============================================================================
otpSchema.pre('save', function (next) {
  if (this.isModified('code')) {
    this.code = this.code.toUpperCase();
  }
  next();
});

// ============================================================================
// Methods للتنظيف (Cleanup)
// ============================================================================
otpSchema.statics.cleanupExpired = async function () {
  const result = await this.deleteMany({
    $or: [
      { expiresAt: { $lt: new Date() } },
      { status: 'expired' },
      { createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }, // أقدم من يوم
    ],
  });
  return result.deletedCount;
};

// ============================================================================
// Export
// ============================================================================
module.exports = mongoose.model('OtpCode', otpSchema);