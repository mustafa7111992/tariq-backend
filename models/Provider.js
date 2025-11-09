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
    // مثل serviceType اللي تستعمله بتطبيقك (كهربائي, نجّار, سحب, ...الخ)
    serviceType: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    avatar: {
      type: String,
    },
    isVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    // إحصائيات بسيطة
    totalCompleted: {
      type: Number,
      default: 0,
    },
    lastJobAt: {
      type: Date,
    },

    // لو تريد تحتفظ بآخر لوكيشن بسيط (غير إللي ب ProviderSettings)
    lastLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [lng, lat]
      },
      updatedAt: {
        type: Date,
      },
    },
  },
  {
    timestamps: true,
  }
);

// indexes
providerSchema.index({ phone: 1 });
providerSchema.index({ serviceType: 1, city: 1 });
providerSchema.index({ createdAt: -1 });

// methods
providerSchema.methods.markJobDone = function () {
  this.totalCompleted += 1;
  this.lastJobAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Provider', providerSchema);