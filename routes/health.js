// routes/health.js
const router = require("express").Router();
const mongoose = require("mongoose");
const { cache } = require("../utils/cache");

router.get("/", async (req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    const dbStatus = dbState === 1 ? "connected" : "disconnected";
    
    // تجربة استعلام بسيط للتأكد من قاعدة البيانات
    let dbResponseTime = null;
    if (dbState === 1) {
      const start = Date.now();
      try {
        await mongoose.connection.db.admin().ping();
        dbResponseTime = Date.now() - start;
      } catch (err) {
        console.error('DB ping failed:', err);
      }
    }

    const health = {
      status: dbStatus === "connected" && dbResponseTime !== null ? "healthy" : "unhealthy",
      database: {
        status: dbStatus,
        responseTime: dbResponseTime ? `${dbResponseTime}ms` : null,
        readyState: dbState
      },
      server: {
        uptime: `${Math.floor(process.uptime())}s`,
        memory: {
          used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
          total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`
        },
        nodeVersion: process.version
      },
      cache: {
        size: cache.size,
        type: "in-memory"
      },
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development"
    };

    const statusCode = health.status === "healthy" ? 200 : 503;
    res.status(statusCode).json(health);
    
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: "unhealthy",
      error: "health check failed",
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;