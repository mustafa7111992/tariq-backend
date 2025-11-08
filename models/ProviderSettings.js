// models/ProviderSettings.js
const mongoose = require('mongoose');

const providerSettingsSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    // يستقبل إشعارات؟
    notificationsEnabled: { type: Boolean, default: true },

    // صوت؟
    soundEnabled: { type: Boolean, default: true },

    // المسافة القصوى للطلبات (يقدر يغيرها من التطبيق)
    maxDistance: {
      type: Number,
      default: 30,     // القيمة الافتراضية
      min: 10,         // أقل شيء 10 كم
      max: 50,         // أكثر شيء 50 كم
      validate: {
        validator: Number.isFinite,
        message: 'maxDistance must be a valid number',
      },
    },

    // أونلاين/أوفلاين
    isOnline: { type: Boolean, default: true, index: true },

    // آخر موقع معروف
    currentLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [lng, lat]
        validate: {
          validator: function (coords) {
            // لازم يكون عندي قيمتين
            if (!Array.isArray(coords) || coords.length !== 2) return false;
            const [lng, lat] = coords;
            return (
              lat >= -90 &&
              lat <= 90 &&
              lng >= -180 &&
              lng <= 180
            );
          },
          message: 'Invalid coordinates format [lng, lat]',
        },
      },
    },

    lastLocationUpdate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Indexes للأداء
providerSettingsSchema.index({ currentLocation: '2dsphere' });
providerSettingsSchema.index({ isOnline: 1, maxDistance: 1 });
providerSettingsSchema.index({ lastLocationUpdate: -1 });

// method: اشكد الموقع قديم؟
providerSettingsSchema.methods.isLocationFresh = function (
  maxAgeMinutes = 60
) {
  if (!this.lastLocationUpdate) return false;
  const ageMinutes =
    (Date.now() - this.lastLocationUpdate.getTime()) / (1000 * 60);
  return ageMinutes <= maxAgeMinutes;
};

// method: احسب المسافة بينه وبين نقطة
providerSettingsSchema.methods.getDistanceFrom = function (lat, lng) {
  if (!this.currentLocation || !this.currentLocation.coordinates) return null;

  const [providerLng, providerLat] = this.currentLocation.coordinates;
  const R = 6371; // km

  const dLat = ((lat - providerLat) * Math.PI) / 180;
  const dLng = ((lng - providerLng) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((providerLat * Math.PI) / 180) *
      Math.cos((lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// static: جيب مزودين أونلاين قرب نقطة
providerSettingsSchema.statics.findNearbyOnline = function (
  lat,
  lng,
  maxDistance = 30
) {
  // لو جاك 70 من العميل ما راح يتخزن لأن الـ schema محدد max: 50
  const safeMax = Math.min(Math.max(maxDistance, 10), 50);

  return this.find({
    isOnline: true,
    currentLocation: {
      $near: {
        $geometry: { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: safeMax * 1000, // km → m
      },
    },
  });
};

module.exports = mongoose.model('ProviderSettings', providerSettingsSchema);