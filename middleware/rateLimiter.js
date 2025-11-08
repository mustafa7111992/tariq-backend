// middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

function buildHandler(message, messageAr) {
  return (req, res) => {
    res.status(429).json({
      ok: false,
      error: message,
      error_ar: messageAr,
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    });
  };
}

// 1) لعموم /api
const general = rateLimit({
  windowMs: 60 * 1000,       // 1 دقيقة
  max: 100,                  // 100 طلب
  standardHeaders: true,
  legacyHeaders: false,
  handler: buildHandler(
    'Too many requests, please try again later',
    'عدد الطلبات كثير، حاول بعد شوية'
  ),
});

// 2) للـ /api/auth (القديم)
const auth = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 دقيقة
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: buildHandler(
    'Too many authentication attempts, please try again later',
    'محاولات تسجيل دخول كثيرة، حاول بعد ربع ساعة'
  ),
});

// 3) للواتساب /api/whatsapp
const otp = rateLimit({
  windowMs: 60 * 1000,       // 1 دقيقة
  max: 3,                    // 3 مرات طلب كود
  standardHeaders: true,
  legacyHeaders: false,
  handler: buildHandler(
    'Too many OTP requests, please wait before requesting again',
    'طلبات رمز التحقق كثيرة، انتظر قليلاً'
  ),
});

// 4) للادمن
const admin = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: buildHandler(
    'Admin rate limit exceeded',
    'تجاوزت حد طلبات الإدارة'
  ),
});

module.exports = {
  general,
  auth,
  otp,
  admin,
};