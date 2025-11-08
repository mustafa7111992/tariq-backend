// controllers/userController.js

const User = require("../models/User");
const { ok, fail } = require("../utils/helpers");
const { logActivity } = require("../utils/activityLogger");

// POST /api/users - للتحديث فقط بعد التحقق من OTP
exports.updateUser = async (req, res) => {
  const { userId, name, serviceType, city } = req.body;

  if (!userId) {
    return fail(res, "userId is required", 400, req);
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return fail(res, "user not found", 404, req);
    }

    // تحديث البيانات
    if (name !== undefined) user.name = name;
    if (serviceType !== undefined) user.serviceType = serviceType;
    if (city !== undefined) user.city = city;
    
    user.lastLogin = new Date();
    await user.save();

    await logActivity("user_update", req, { userId: user._id });
    return ok(res, user);
  } catch (error) {
    console.error('updateUser error:', error);
    return fail(res, "internal error", 500, req);
  }
};

// GET /api/users/:id - الحصول على معلومات يوزر محدد
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id).select('-__v').lean();
    if (!user) {
      return fail(res, "user not found", 404, req);
    }

    return ok(res, user);
  } catch (error) {
    console.error('getUserById error:', error);
    return fail(res, "internal error", 500, req);
  }
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