// server.js
const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
const whatsappRoutes = require('./routes/whatsapp');
const customerRoutes = require('./routes/customers'); // 👈 جديد
const providerRoutes = require('./routes/providers');

app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/customers', customerRoutes); // 👈 جديد
app.use('/api/providers', providerRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date(),
    user: 'mustafa7111992' 
  });
});

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch((err) => console.error('❌ MongoDB Error:', err));

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`👤 User: mustafa7111992`);
});