// server.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");

const connectDB = require("./config/database");
const errorHandler = require("./middleware/errorHandler");
const { createLimiter } = require("./middleware/rateLimiter");

// routes
const healthRoutes = require("./routes/health");
const serviceRoutes = require("./routes/services");
const userRoutes = require("./routes/users");
const requestRoutes = require("./routes/requests");
const providerRoutes = require("./routes/provider");
const adminRoutes = require("./routes/admin");

const app = express();

// ====== request id ======
app.use((req, res, next) => {
  req.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  res.setHeader("X-Request-ID", req.id);
  next();
});

// ====== perf ======
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const dur = Date.now() - start;
    if (dur > 1000) {
      console.warn(`⚠️ Slow request ${req.method} ${req.url} ${dur}ms`);
    }
  });
  next();
});

// ====== core middlewares ======
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(
  helmet({
    contentSecurityPolicy: process.env.NODE_ENV === "production",
    crossOriginEmbedderPolicy: false,
  })
);
app.use(compression());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// ====== rate limit per group ======
app.use("/api/users", createLimiter(10, 60 * 1000));
app.use("/api/requests", createLimiter(30, 60 * 1000));
app.use("/api", createLimiter(100, 60 * 1000));

// ====== routes ======
app.use("/health", healthRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/users", userRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/provider", providerRoutes);
app.use("/api/admin", adminRoutes);

// root
app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "Tariq backend is running ✅",
    version: "2.0.0",
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ ok: false, error: "Not found" });
});

// error handler
app.use(errorHandler);

// ====== start ======
const PORT = process.env.PORT || 5001;
connectDB().then(() => {
  const server = app.listen(PORT, () => {
    console.log(`🚀 Server listening on port ${PORT}`);
  });

  // graceful shutdown
  process.on("SIGTERM", async () => {
    console.log("🛑 SIGTERM, closing server...");
    server.close();
    process.exit(0);
  });
  process.on("SIGINT", async () => {
    console.log("🛑 SIGINT, closing server...");
    server.close();
    process.exit(0);
  });
});

module.exports = app;