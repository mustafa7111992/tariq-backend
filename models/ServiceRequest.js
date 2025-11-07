// models/ServiceRequest.js
const mongoose = require('mongoose');

const serviceRequestSchema = new mongoose.Schema({
  serviceType: { type: String, required: true },
  notes: String,
  city: { type: String, default: null },
  location: {
    type: { type: String, default: 'Point' },
    coordinates: [Number],
  },
  status: { type: String, default: 'pending' }, // pending | accepted | on-the-way | in-progress | done | cancelled
  acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  acceptedByPhone: { type: String, default: null },
  customerPhone: { type: String, default: null },
  acceptedAt: Date,
  completedAt: Date,
  cancelledAt: Date,
  estimatedArrival: Date,
  providerRating: {
    score: { type: Number, min: 1, max: 5 },
    comment: String,
    ratedAt: Date,
  },
  customerRating: {
    score: { type: Number, min: 1, max: 5 },
    comment: String,
    ratedAt: Date,
  },
}, { timestamps: true });

serviceRequestSchema.index({ location: '2dsphere' });
serviceRequestSchema.index({ status: 1, acceptedByPhone: 1 });
serviceRequestSchema.index({ customerPhone: 1, createdAt: -1 });
serviceRequestSchema.index({ acceptedByPhone: 1, status: 1 });
serviceRequestSchema.index({ serviceType: 1, status: 1 });

module.exports = mongoose.model('ServiceRequest', serviceRequestSchema);