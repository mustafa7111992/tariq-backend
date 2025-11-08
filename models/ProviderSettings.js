// models/ProviderSettings.js
const mongoose = require('mongoose');

const providerSettingsSchema = new mongoose.Schema({
  phone: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    index: true 
  },
  notificationsEnabled: { type: Boolean, default: true },
  soundEnabled: { type: Boolean, default: true },
  maxDistance: { 
    type: Number, 
    default: 30,
    min: 1,
    max: 100 // حد أقصى منطقي
  },
  isOnline: { type: Boolean, default: true, index: true },
  currentLocation: {
    type: { 
      type: String, 
      enum: ['Point'],
      default: 'Point' 
    },
    coordinates: {
      type: [Number], // [lng, lat]
      validate: {
        validator: function(coords) {
          return coords.length === 2 && 
                 coords[1] >= -90 && coords[1] <= 90 && // lat
                 coords[0] >= -180 && coords[0] <= 180; // lng
        },
        message: 'Invalid coordinates format [lng, lat]'
      }
    },
  },
  lastLocationUpdate: { type: Date, default: Date.now },
}, { timestamps: true });

// Indexes للأداء الأمثل
providerSettingsSchema.index({ currentLocation: '2dsphere' }); // للبحث الجغرافي
providerSettingsSchema.index({ isOnline: 1, maxDistance: 1 }); // للبحث عن المزودين المتاحين
providerSettingsSchema.index({ lastLocationUpdate: -1 }); // لترتيب آخر تحديث موقع

// Methods مفيدة
providerSettingsSchema.methods.isLocationFresh = function(maxAgeMinutes = 60) {
  if (!this.lastLocationUpdate) return false;
  const ageMinutes = (Date.now() - this.lastLocationUpdate.getTime()) / (1000 * 60);
  return ageMinutes <= maxAgeMinutes;
};

providerSettingsSchema.methods.getDistanceFrom = function(lat, lng) {
  if (!this.currentLocation || !this.currentLocation.coordinates) return null;
  
  const [providerLng, providerLat] = this.currentLocation.coordinates;
  const R = 6371; // Earth's radius in km
  
  const dLat = (lat - providerLat) * Math.PI / 180;
  const dLng = (lng - providerLng) * Math.PI / 180;
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(providerLat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
};

// Static methods
providerSettingsSchema.statics.findNearbyOnline = function(lat, lng, maxDistance = 30) {
  return this.find({
    isOnline: true,
    currentLocation: {
      $near: {
        $geometry: { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: maxDistance * 1000 // Convert km to meters
      }
    }
  });
};

module.exports = mongoose.model('ProviderSettings', providerSettingsSchema);