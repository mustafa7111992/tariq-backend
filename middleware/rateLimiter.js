// middleware/rateLimiter.js
const rateLimit = require("express-rate-limit");

function createLimiter(max, windowMs) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, error: "عدد الطلبات كثير، حاول بعد شوية" },
    skip: (req) => req.headers["x-admin-key"] === process.env.ADMIN_KEY,
  });
}

module.exports = { createLimiter };