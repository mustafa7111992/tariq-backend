// middleware/requestId.js
const crypto = require('crypto');

function generateRequestId() {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `req_${timestamp}_${random}`;
}

module.exports = (req, res, next) => {
  const existingId = req.headers['x-request-id'] || req.headers['x-correlation-id'];
  const isValidId = existingId && /^[\w\-:.]{1,100}$/.test(existingId);

  req.id = isValidId ? existingId : generateRequestId();
  res.locals.requestId = req.id;

  res.setHeader('X-Request-ID', req.id);
  res.setHeader('X-Correlation-ID', req.id);

  req.startTime = Date.now();

  next();
};