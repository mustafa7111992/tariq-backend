// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  phone: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    index: true 
  },
  role: { 
    type: String, 
    enum: ['customer', 'provider', 'admin'], 
    default: 'customer',
    index: true 
  },
  serviceType: { type: String, trim: true }, // لو provider
  city: { type: String, trim: true },
  isActive: { type: Boolean, default: true, index: true },
  lastLogin: { type: Date, default: Date.now },
}, { timestamps: true });

// Indexes للأداء الأمثل (phone و role مدمجين في schema)
userSchema.index({ isActive: 1, role: 1 }); // للفلترة المركبة
userSchema.index({ role: 1, createdAt: -1 }); // للترتيب حسب تاريخ التسجيل
userSchema.index({ lastLogin: -1 }); // لترتيب آخر دخول

module.exports = mongoose.model('User', userSchema);