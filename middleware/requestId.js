// middleware/requestId.js
module.exports = (req, res, next) => {
  req.id = Date.now().toString(36) + Math.random().toString(36);
  res.setHeader('X-Request-ID', req.id);
  next();
};