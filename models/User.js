// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: String,
    phone: { type: String, required: true, unique: true },
    role: { type: String, default: "customer" }, // customer | provider | admin
    serviceType: String,
    city: String,
    isActive: { type: Boolean, default: true },
    lastLogin: Date,
  },
  { timestamps: true }
);

userSchema.index({ phone: 1 });
userSchema.index({ role: 1 });

module.exports = mongoose.model("User", userSchema);