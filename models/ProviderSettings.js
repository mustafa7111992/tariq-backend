// models/ProviderSettings.js
const mongoose = require('mongoose');

const providerSettingsSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  notificationsEnabled: { type: Boolean, default: true },
  soundEnabled: { type: Boolean, default: true },
  maxDistance: { type: Number, default: 30 },
  isOnline: { type: Boolean, default: true },
  currentLocation: {
    type: { type: String, default: 'Point' },
    coordinates: [Number],
  },
  lastLocationUpdate: Date,
}, { timestamps: true });

providerSettingsSchema.index({ phone: 1 });
providerSettingsSchema.index({ isOnline: 1 });

module.exports = mongoose.model('ProviderSettings', providerSettingsSchema);