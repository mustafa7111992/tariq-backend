// middleware/responseTime.js
module.exports = (req, res, next) => {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1_000_000; // ms

    // ما نحاول نضيف هيدر بعد ما انرسل
    if (!res.headersSent) {
      res.setHeader('X-Response-Time', `${duration.toFixed(2)}ms`);
    }

    const logData = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration.toFixed(2)}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection?.remoteAddress,
      requestId: req.requestId,
    };

    if (duration > 5000) {
      console.error('🔴 Critical slow request:', logData);
    } else if (duration > 2000) {
      console.warn('🟡 Slow request:', logData);
    } else if (duration > 1000) {
      console.warn('⚠️ Warning - slow request:', logData);
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Request completed:', logData);
      }
    }

    // لو عندك متركس خارجي
    if (global.metrics) {
      global.metrics.recordResponseTime(req.route?.path || req.url, duration);
    }
  });

  next();
};