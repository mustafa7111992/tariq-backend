// controllers/userController.js
const User = require("../models/User");
const { ok } = require("../utils/helpers");
const { logActivity } = require("../utils/activityLogger");

exports.createOrLoginUser = async (req, res) => {
  const { name, phone, role, serviceType, city } = req.body;

  let user = await User.findOne({ phone });
  if (user) {
    user.lastLogin = new Date();
    await user.save();
    await logActivity(req, "user_login", { userId: user._id });
    return ok(res, user);
  }

  user = await User.create({
    name: name || "",
    phone,
    role: role || "customer",
    serviceType: serviceType || null,
    city: city || null,
    lastLogin: new Date(),
  });

  await logActivity(req, "user_register", { userId: user._id });
  return ok(res, user);
};

exports.getUsers = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  const { role, search } = req.query;

  const filter = { isActive: true };
  if (role) filter.role = role;
  if (search) {
    filter.$or = [
      { name: new RegExp(search, "i") },
      { phone: new RegExp(search, "i") },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  ok(res, users, {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
  });
};