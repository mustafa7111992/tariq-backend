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
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/users');
const requestRoutes = require('./routes/requests');
const providerRoutes = require('./routes/provider');
const serviceRoutes = require('./routes/services');
const healthRoutes = require('./routes/health');

const app = express();
connectDB();

// ميدلوير عام
app.use(requestId);
app.use(responseTimeLogger);
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// rate limit
app.use('/api', rateLimiter);

// routes
app.use('/health', healthRoutes);
app.use('/api/users', userRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/provider', providerRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/admin', adminRoutes);

// 404 + error
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});