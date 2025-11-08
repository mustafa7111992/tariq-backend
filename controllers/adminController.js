// controllers/adminController.js
const User = require("../models/User");
const ServiceRequest = require("../models/ServiceRequest");
const ActivityLog = require("../models/ActivityLog");
const { ok, fail } = require("../utils/helpers");
const { getCache, setCache, clearCache } = require("../utils/cache");

// توحيد الرقم - نفس باقي الكنترولرز
function normalizePhone(raw) {
  if (!raw) return null;
  const p = raw.trim().replace(/\s+/g, '');
  
  if (p.startsWith('07')) {
    return `+964${p.slice(1)}`;
  }
  
  if (p.startsWith('+')) {
    if (!/^\+[0-9]+$/.test(p)) return null;
    return p;
  }
  
  if (!/^[0-9]+$/.test(p)) return null;
  return p;
}

// Helper للتحقق من admin
async function validateAdmin(phone) {
  if (!phone) return { valid: false, error: 'phone is required' };
  
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return { valid: false, error: 'invalid phone format' };
  }
  
  const user = await User.findOne({ phone: normalizedPhone, role: 'admin' });
  if (!user) {
    return { valid: false, error: 'admin access required' };
  }
  return { valid: true, user, normalizedPhone };
}

exports.getOverview = async (req, res) => {
  try {
    // التحقق من admin (يمكن من header أو query)
    const adminPhone = req.query.adminPhone || req.headers['x-admin-phone'];
    if (adminPhone) {
      const validation = await validateAdmin(adminPhone);
      if (!validation.valid) {
        return fail(res, validation.error, 403, req);
      }
    }

    const cacheKey = "admin:overview";
    const cached = getCache(cacheKey);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      return ok(res, cached);
    }

    const [users, requests, done, pending, providers, activeRequests, customers] =
      await Promise.all([
        User.countDocuments({ isActive: true }),
        ServiceRequest.countDocuments(),
        ServiceRequest.countDocuments({ status: "done" }),
        ServiceRequest.countDocuments({ status: "pending" }),
        User.countDocuments({ role: "provider", isActive: true }),
        ServiceRequest.countDocuments({
          status: { $in: ["accepted", "on-the-way", "in-progress"] },
        }),
        User.countDocuments({ role: "customer", isActive: true }),
      ]);

    // إحصائيات إضافية
    const cancelled = await ServiceRequest.countDocuments({ status: "cancelled" });
    const avgCompletionTime = await ServiceRequest.aggregate([
      { $match: { status: "done", completedAt: { $exists: true }, acceptedAt: { $exists: true } } },
      { 
        $project: { 
          duration: { $subtract: ["$completedAt", "$acceptedAt"] } 
        } 
      },
      { $group: { _id: null, avgDuration: { $avg: "$duration" } } }
    ]);

    const data = {
      users,
      customers,
      providers,
      requests,
      done,
      pending,
      cancelled,
      activeRequests,
      completionRate: requests > 0 ? Math.round((done / requests) * 100) : 0,
      cancellationRate: requests > 0 ? Math.round((cancelled / requests) * 100) : 0,
      avgCompletionTimeMinutes: avgCompletionTime.length > 0 
        ? Math.round(avgCompletionTime[0].avgDuration / (1000 * 60)) 
        : null,
      generatedAt: new Date(),
    };

    setCache(cacheKey, data, 60 * 1000); // كاش لدقيقة واحدة
    res.setHeader("X-Cache", "MISS");
    return ok(res, data);
  } catch (error) {
    console.error('getOverview error:', error);
    return fail(res, "internal error", 500, req);
  }
};

exports.getActivity = async (req, res) => {
  try {
    // التحقق من admin
    const adminPhone = req.query.adminPhone || req.headers['x-admin-phone'];
    if (adminPhone) {
      const validation = await validateAdmin(adminPhone);
      if (!validation.valid) {
        return fail(res, validation.error, 403, req);
      }
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const { phone, action } = req.query;

    let filter = {};
    
    // فلترة بالرقم مع التوحيد
    if (phone) {
      const normalizedPhone = normalizePhone(phone);
      if (normalizedPhone) {
        filter.userPhone = normalizedPhone;
      }
    }

    // فلترة بنوع النشاط
    if (action) {
      filter.action = action;
    }

    const [logs, total] = await Promise.all([
      ActivityLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ActivityLog.countDocuments(filter),
    ]);

    return ok(res, logs, {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      filter, // إرجاع الفلتر المطبق للمراجعة
    });
  } catch (error) {
    console.error('getActivity error:', error);
    return fail(res, "internal error", 500, req);
  }
};

exports.clearCache = async (req, res) => {
  try {
    // التحقق من admin
    const adminPhone = req.body.adminPhone || req.headers['x-admin-phone'];
    const validation = await validateAdmin(adminPhone);
    if (!validation.valid) {
      return fail(res, validation.error, 403, req);
    }

    const { key, pattern } = req.body;
    
    if (key) {
      clearCache(key);
      console.log(`Cache key cleared by admin ${validation.normalizedPhone}: ${key}`);
    } else if (pattern) {
      clearCache(pattern);
      console.log(`Cache pattern cleared by admin ${validation.normalizedPhone}: ${pattern}`);
    } else {
      clearCache(); // مسح كل الكاش
      console.log(`All cache cleared by admin ${validation.normalizedPhone}`);
    }

    return ok(res, { 
      message: "cache cleared successfully",
      clearedBy: validation.normalizedPhone,
      clearedAt: new Date()
    });
  } catch (error) {
    console.error('clearCache error:', error);
    return fail(res, "internal error", 500, req);
  }
};

// إحصائيات مفصلة حسب الفترة الزمنية
exports.getDetailedStats = async (req, res) => {
  try {
    const adminPhone = req.query.adminPhone || req.headers['x-admin-phone'];
    const validation = await validateAdmin(adminPhone);
    if (!validation.valid) {
      return fail(res, validation.error, 403, req);
    }

    const { days = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const [dailyRequests, topProviders, serviceTypes] = await Promise.all([
      // طلبات يومية
      ServiceRequest.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ["$status", "done"] }, 1, 0] } }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      
      // أفضل مزودين
      ServiceRequest.aggregate([
        { $match: { acceptedByPhone: { $exists: true }, status: "done" } },
        { 
          $group: { 
            _id: "$acceptedByPhone", 
            completed: { $sum: 1 },
            avgRating: { $avg: "$providerRating.score" }
          } 
        },
        { $sort: { completed: -1 } },
        { $limit: 10 }
      ]),

      // أنواع الخدمات
      ServiceRequest.aggregate([
        {
          $group: {
            _id: "$serviceType",
            count: { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ["$status", "done"] }, 1, 0] } }
          }
        },
        { $sort: { count: -1 } }
      ])
    ]);

    return ok(res, {
      dailyRequests,
      topProviders,
      serviceTypes,
      period: `${days} days`,
      generatedAt: new Date()
    });
  } catch (error) {
    console.error('getDetailedStats error:', error);
    return fail(res, "internal error", 500, req);
  }
};

// إدارة المستخدمين
exports.manageUser = async (req, res) => {
  try {
    const adminPhone = req.body.adminPhone || req.headers['x-admin-phone'];
    const validation = await validateAdmin(adminPhone);
    if (!validation.valid) {
      return fail(res, validation.error, 403, req);
    }

    const { userPhone, action } = req.body; // action: 'activate', 'deactivate', 'delete'
    
    if (!userPhone || !action) {
      return fail(res, "userPhone and action are required", 400, req);
    }

    const normalizedUserPhone = normalizePhone(userPhone);
    if (!normalizedUserPhone) {
      return fail(res, "invalid user phone format", 400, req);
    }

    const user = await User.findOne({ phone: normalizedUserPhone });
    if (!user) {
      return fail(res, "user not found", 404, req);
    }

    switch (action) {
      case 'activate':
        user.isActive = true;
        break;
      case 'deactivate':
        user.isActive = false;
        break;
      case 'delete':
        await User.deleteOne({ _id: user._id });
        console.log(`User deleted by admin ${validation.normalizedPhone}: ${normalizedUserPhone}`);
        return ok(res, { message: "user deleted successfully" });
      default:
        return fail(res, "invalid action", 400, req);
    }

    await user.save();
    console.log(`User ${action}d by admin ${validation.normalizedPhone}: ${normalizedUserPhone}`);

    return ok(res, { 
      message: `user ${action}d successfully`,
      user: {
        phone: user.phone,
        role: user.role,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('manageUser error:', error);
    return fail(res, "internal error", 500, req);
  }
};