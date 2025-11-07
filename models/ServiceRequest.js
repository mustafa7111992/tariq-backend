// models/ServiceRequest.js
const mongoose = require("mongoose");

const serviceRequestSchema = new mongoose.Schema(
  {
    serviceType: { type: String, required: true },
    notes: String,
    city: String,
    location: {
      type: { type: String, default: "Point" },
      coordinates: [Number], // [lng, lat]
    },
    status: { type: String, default: "pending" },
    acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    acceptedByPhone: String,
    customerPhone: String,
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
  },
  { timestamps: true }
);

serviceRequestSchema.index({ location: "2dsphere" });
serviceRequestSchema.index({ status: 1, acceptedByPhone: 1 });
serviceRequestSchema.index({ customerPhone: 1, createdAt: -1 });

module.exports = mongoose.model("ServiceRequest", serviceRequestSchema);