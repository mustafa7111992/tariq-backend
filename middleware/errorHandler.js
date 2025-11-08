// middleware/errorHandler.js
const { fail } = require('../utils/helpers');

function notFound(_req, res) {
  return res.status(404).json({ ok: false, error: 'Not found' });
}

function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  if (err.name === 'CastError') {
    return fail(res, 'Invalid ID format', 400, req);
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0];
    return fail(res, `${field} already exists`, 409, req);
  }
  return res.status(statusCode).json({
    ok: false,
    error: err.message || 'server error',
    requestId: req.id,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}

module.exports = { notFound, errorHandler };