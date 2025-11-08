// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');

const connectDB = require('./config/database');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const rateLimiter = require('./middleware/rateLimiter');
const requestId = require('./middleware/requestId');
const responseTimeLogger = require('./middleware/responseTime');

// routes
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/users');
const requestRoutes = require('./routes/requests');
const providerRoutes = require('./routes/provider');
const serviceRoutes = require('./routes/services');
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');         // Legacy auth (deprecated - use whatsapp instead)
const whatsappRoutes = require('./routes/whatsapp'); // Modern OTP authentication via WhatsApp

const app = express();

// مهم للـ Render / Nginx / proxies
app.set('trust proxy', 1);

// اتصال الداتابيس
connectDB();

// ميدلوير عام
app.use(requestId);
app.use(responseTimeLogger);
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// General rate limiting for all API routes
app.use('/api', rateLimiter.general);

// Public routes (no rate limiting)
app.use('/health', healthRoutes);

// Authentication routes (stricter rate limiting)
app.use('/api/auth', rateLimiter.auth, authRoutes);       // Legacy - use /api/whatsapp instead
app.use('/api/whatsapp', rateLimiter.otp, whatsappRoutes); // Primary authentication method

// Protected API routes (rate limited)
app.use('/api/users', userRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/provider', providerRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/admin', rateLimiter.admin, adminRoutes);

// 404 + error
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5001;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 WhatsApp Auth: http://localhost:${PORT}/api/whatsapp/send-code`);
  console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});