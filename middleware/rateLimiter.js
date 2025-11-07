// middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

module.exports = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'عدد الطلبات كثير، حاول بعد شوية' },
});