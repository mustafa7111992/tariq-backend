// controllers/userController.js

const User = require("../models/User");
const { ok, fail } = require("../utils/helpers");
const { logActivity } = require("../utils/activityLogger");

// POST /api/users
exports.createOrLoginUser = async (req, res) => {
  const { name, phone, role, serviceType, city } = req.body;

  if (!phone) {
    return fail(res, "phone is required", 400, req);
  }

  let user = await User.findOne({ phone });

  if (user) {
    user.lastLogin = new Date();
    await user.save();
    await logActivity("user_login", req, { userId: user._id });
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

  await logActivity("user_register", req, { userId: user._id });
  return ok(res, user);
};

// GET /api/users
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
      .select("-__v")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  return ok(res, users, {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
  });
};