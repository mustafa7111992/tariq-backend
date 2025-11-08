// routes/health.js
const router = require("express").Router();
const mongoose = require("mongoose");
const { cache } = require("../utils/cache");

router.get("/", (req, res) => {
  const db = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  res.status(db === "connected" ? 200 : 503).json({
    status: db === "connected" ? "healthy" : "unhealthy",
    db,
    uptime: process.uptime(),
    cacheSize: cache.size,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;