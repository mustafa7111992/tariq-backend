// middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

// General API rate limiter
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { 
    ok: false, 
    error: 'Too many requests, please try again later',
    error_ar: 'عدد الطلبات كثير، حاول بعد شوية'
  },
  // Add request info to help debug
  onLimitReached: (req) => {
    console.log(`Rate limit exceeded for IP: ${req.ip}, URL: ${req.url}`);
  }
});

// Stricter limiter for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { 
    ok: false, 
    error: 'Too many authentication attempts, please try again later',
    error_ar: 'محاولات تسجيل دخول كثيرة، حاول بعد ربع ساعة'
  },
  onLimitReached: (req) => {
    console.log(`Auth rate limit exceeded for IP: ${req.ip}, URL: ${req.url}`);
  }
});

// Very strict limiter for WhatsApp/SMS sending
const otpLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // 3 OTP requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { 
    ok: false, 
    error: 'Too many OTP requests, please wait before requesting again',
    error_ar: 'طلبات رمز التحقق كثيرة، انتظر قليلاً'
  },
  onLimitReached: (req) => {
    console.log(`OTP rate limit exceeded for IP: ${req.ip}`);
  }
});

// Admin operations limiter
const adminLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute for admin
  standardHeaders: true,
  legacyHeaders: false,
  message: { 
    ok: false, 
    error: 'Admin rate limit exceeded',
    error_ar: 'تجاوز حد طلبات الإدارة'
  }
});

module.exports = {
  general: generalLimiter,
  auth: authLimiter,
  otp: otpLimiter,
  admin: adminLimiter
};