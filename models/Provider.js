// models/Provider.js
const mongoose = require('mongoose');

const providerSchema = new mongoose.Schema(
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
    serviceType: {
      type: String,
      enum: ['fuel', 'tow', 'tire', 'battery', 'mechanic'],
      required: true,
    },
    city: {
      type: String,
      required: true,
      index: true,
    },
    carPlate: {
      type: String,
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
    isAvailable: {
      type: Boolean,
      default: true,
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalRatings: {
      type: Number,
      default: 0,
    },
    completedJobs: {
      type: Number,
      default: 0,
    },
    rejectedJobs: {
      type: Number,
      default: 0,
    },
    // ساعات العمل
    workingHours: {
      start: { type: String, default: '08:00' },
      end: { type: String, default: '22:00' },
    },
    // الموقع الجغرافي
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
      },
    },
  },
  {
    timestamps: true,
  }
);

// ============================================================================
// Indexes
// ============================================================================
providerSchema.index({ phone: 1 });
providerSchema.index({ city: 1, serviceType: 1 });
providerSchema.index({ rating: -1 });
providerSchema.index({ location: '2dsphere' }); // للبحث الجغرافي

// ============================================================================
// Methods
// ============================================================================
providerSchema.methods.updateAvailability = function(available) {
  this.isAvailable = available;
  return this.save();
};

providerSchema.methods.incrementCompletedJobs = function() {
  this.completedJobs += 1;
  return this.save();
};

providerSchema.methods.addRating = function(newRating) {
  // حساب المتوسط
  const totalRatings = this.totalRatings + 1;
  const currentTotal = this.rating * this.totalRatings;
  this.rating = ((currentTotal + newRating) / totalRatings).toFixed(2);
  this.totalRatings = totalRatings;
  return this.save();
};

// ============================================================================
// Static Methods
// ============================================================================
providerSchema.statics.findAvailable = function(filters = {}) {
  const query = {
    isVerified: true,
    isActive: true,
    isAvailable: true,
  };

  if (filters.serviceType) {
    query.serviceType = filters.serviceType;
  }

  if (filters.city) {
    query.city = filters.city;
  }

  return this.find(query).sort({ rating: -1, completedJobs: -1 });
};

providerSchema.statics.findByServiceAndCity = function(serviceType, city) {
  return this.find({
    serviceType,
    city,
    isVerified: true,
    isActive: true,
    isAvailable: true,
  }).sort({ rating: -1 });
};

module.exports = mongoose.model('Provider', providerSchema);