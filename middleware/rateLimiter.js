// middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

// عام
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: 'Too many requests, please try again later',
    error_ar: 'عدد الطلبات كثير، حاول بعد شوية',
  },
  onLimitReached: (req) => {
    console.log(`Rate limit exceeded for IP: ${req.ip}, URL: ${req.url}`);
  },
});

// تسجيل الدخول / OTP عادي
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: 'Too many authentication attempts, please try again later',
    error_ar: 'محاولات تسجيل دخول كثيرة، حاول بعد ربع ساعة',
  },
  onLimitReached: (req) => {
    console.log(`Auth rate limit exceeded for IP: ${req.ip}, URL: ${req.url}`);
  },
});

// إرسال واتساب
const otpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: 'Too many OTP requests, please wait before requesting again',
    error_ar: 'طلبات رمز التحقق كثيرة، انتظر قليلاً',
  },
  onLimitReached: (req) => {
    console.log(`OTP rate limit exceeded for IP: ${req.ip}`);
  },
});

// ادمن
const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: 'Admin rate limit exceeded',
    error_ar: 'تجاوز حد طلبات الإدارة',
  },
});

module.exports = {
  general: generalLimiter,
  auth: authLimiter,
  otp: otpLimiter,
  admin: adminLimiter,
};