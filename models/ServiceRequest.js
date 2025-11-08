// models/ServiceRequest.js
const mongoose = require("mongoose");

const ServiceRequestSchema = new mongoose.Schema(
  {
    serviceType: { type: String, required: true },
    notes: { type: String, default: "" },
    city: { type: String, default: null },

    // مهم 👇
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [lng, lat]
      },
    },

    customerPhone: { type: String, index: true },
    status: {
      type: String,
      enum: [
        "pending",
        "accepted",
        "on-the-way",
        "in-progress",
        "done",
        "cancelled",
      ],
      default: "pending",
      index: true,
    },

    acceptedByPhone: { type: String, default: null, index: true },
    acceptedAt: Date,
    completedAt: Date,
    cancelledAt: Date,

    providerRating: {
      score: Number,
      comment: String,
      ratedAt: Date,
    },
    customerRating: {
      score: Number,
      comment: String,
      ratedAt: Date,
    },
  },
  { timestamps: true }
);

// هذا اللي كان ناقص 👇
ServiceRequestSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("ServiceRequest", ServiceRequestSchema);