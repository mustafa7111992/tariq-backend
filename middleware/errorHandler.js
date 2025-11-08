// middleware/errorHandler.js
const { fail } = require('../utils/helpers');

function notFound(req, res) {
  console.log(`404 - Route not found: ${req.method} ${req.url}`);
  return res.status(404).json({ 
    ok: false, 
    error: 'Route not found',
    path: req.url,
    method: req.method,
    requestId: req.id
  });
}

function errorHandler(err, req, res, _next) {
  // Log the error for monitoring
  console.error(`Error ${req.id}:`, {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });

  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal server error';

  // MongoDB CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  }

  // MongoDB Validation Error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const errors = Object.values(err.errors).map(e => e.message);
    message = `Validation failed: ${errors.join(', ')}`;
  }

  // MongoDB Duplicate Key Error
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    message = `${field} already exists`;
  }

  // JWT Errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Twilio/WhatsApp Errors
  if (err.code && err.code.toString().startsWith('2')) { // Twilio error codes start with 2
    statusCode = 400;
    message = 'Failed to send message';
  }

  // Rate limiting errors
  if (err.message && err.message.includes('Too many requests')) {
    statusCode = 429;
    message = 'Too many requests, please try again later';
  }

  // Prepare response
  const response = {
    ok: false,
    error: message,
    requestId: req.id,
    timestamp: new Date().toISOString()
  };

  // Add debug info in development
  if (process.env.NODE_ENV !== 'production') {
    response.debug = {
      stack: err.stack,
      name: err.name,
      code: err.code,
      url: req.url,
      method: req.method
    };
  }

  return res.status(statusCode).json(response);
}

module.exports = { notFound, errorHandler };