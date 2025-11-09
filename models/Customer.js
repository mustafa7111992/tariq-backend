// models/Customer.js
const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    avatar: {
      type: String,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // تاريخ آخر طلب
    lastRequestAt: {
      type: Date,
    },
    // عدد الطلبات الكلي
    totalRequests: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// ============================================================================
// Indexes
// ============================================================================
customerSchema.index({ phone: 1 });
customerSchema.index({ createdAt: -1 });

// ============================================================================
// Methods
// ============================================================================
customerSchema.methods.incrementRequests = function() {
  this.totalRequests += 1;
  this.lastRequestAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Customer', customerSchema);