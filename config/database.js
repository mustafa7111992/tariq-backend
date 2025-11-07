// config/database.js
const mongoose = require('mongoose');

module.exports = async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('❌ MONGO_URI غير موجود');
    process.exit(1);
  }
  try {
    await mongoose.connect(uri, {
      dbName: 'tariqdb',
      serverSelectionTimeoutMS: 5000,
    });
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB error:', err);
    process.exit(1);
  }
};