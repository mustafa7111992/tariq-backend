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
      score: { type: Number, min: 1, max: 5 },
      comment: { type: String, default: "" },
      ratedAt: { type: Date, default: Date.now },
    },
    customerRating: {
      score: { type: Number, min: 1, max: 5 },
      comment: { type: String, default: "" },
      ratedAt: { type: Date, default: Date.now },
    },
  },
  { timestamps: true }
);

// Indexes للأداء الأمثل
ServiceRequestSchema.index({ location: "2dsphere" });
ServiceRequestSchema.index({ status: 1, createdAt: -1 }); // للفلترة والترتيب
ServiceRequestSchema.index({ acceptedByPhone: 1, status: 1 }); // لطلبات المزود
ServiceRequestSchema.index({ customerPhone: 1, createdAt: -1 }); // لطلبات الزبون
ServiceRequestSchema.index({ serviceType: 1, status: 1 }); // لفلترة نوع الخدمة

module.exports = mongoose.model("ServiceRequest", ServiceRequestSchema);