// middleware/requestId.js
const crypto = require('crypto');

// Generate a shorter, more readable request ID
function generateRequestId() {
  const timestamp = Date.now().toString(36); // Base36 timestamp
  const random = crypto.randomBytes(4).toString('hex'); // 8 char random
  return `req_${timestamp}_${random}`;
}

module.exports = (req, res, next) => {
  // Check if request already has an ID (from load balancer, etc.)
  const existingId = req.headers['x-request-id'] || req.headers['x-correlation-id'];
  
  // Use existing ID or generate new one
  req.id = existingId || generateRequestId();
  
  // Set response headers
  res.setHeader('X-Request-ID', req.id);
  res.setHeader('X-Correlation-ID', req.id); // For distributed tracing
  
  // Add to request start time for performance tracking
  req.startTime = Date.now();
  
  next();
};