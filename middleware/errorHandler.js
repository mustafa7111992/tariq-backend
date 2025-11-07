// middleware/errorHandler.js
const { fail } = require("../utils/helpers");

function errorHandler(err, req, res, next) {
  const status = err.statusCode || 500;

  if (status >= 500) {
    console.error("❌ Server error:", {
      msg: err.message,
      stack: err.stack,
      reqId: req.id,
      url: req.url,
      body: req.body,
    });
  }

  // mongoose duplicate
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0];
    return fail(res, `${field} already exists`, 409, req.id);
  }

  return res.status(status).json({
    ok: false,
    error:
      process.env.NODE_ENV === "production" && status >= 500
        ? "server error"
        : err.message,
    requestId: req.id,
  });
}

module.exports = errorHandler;