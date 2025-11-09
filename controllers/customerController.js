// controllers/customerController.js

const Customer = require('../models/Customer');
const ServiceRequest = require('../models/ServiceRequest');
const { ok, fail } = require('../utils/helpers');
const { logActivity } = require('../utils/activityLogger');
const { getCache, setCache, clearCache } = require('../utils/cache');

// ============================================================================
// GET /api/customers - جلب جميع العملاء
// ============================================================================
exports.getCustomers = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const { search, isActive, isVerified } = req.query;

  try {
    const filter = {};

    // فلترة حسب الحالة
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    if (isVerified !== undefined) {
      filter.isVerified = isVerified === 'true';
    }

    // البحث بالاسم أو الرقم
    if (search) {
      filter.$or = [
        { name: new RegExp(search, 'i') },
        { phone: new RegExp(search, 'i') },
      ];
    }

    const [customers, total] = await Promise.all([
      Customer.find(filter)
        .select('-__v')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Customer.countDocuments(filter),
    ]);

    return ok(res, customers, {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('❌ getCustomers error:', error);
    return fail(res, 'internal error', 500, req);
  }
};

// ============================================================================
// GET /api/customers/:phone - جلب عميل معين
// ============================================================================
exports.getCustomerByPhone = async (req, res) => {
  const { phone } = req.params;

  if (!phone) {
    return fail(res, 'phone is required', 400, req);
  }

  try {
    const customer = await Customer.findOne({ phone })
      .select('-__v')
      .lean();

    if (!customer) {
      return fail(res, 'customer not found', 404, req);
    }

    // جلب عدد الطلبات
    const requestsCount = await ServiceRequest.countDocuments({
      customerPhone: phone,
    });

    return ok(res, {
      ...customer,
      totalRequests: requestsCount,
    });
  } catch (error) {
    console.error('❌ getCustomerByPhone error:', error);
    return fail(res, 'internal error', 500, req);
  }
};

// ============================================================================
// GET /api/customers/:phone/requests - جلب طلبات العميل
// ============================================================================
exports.getCustomerRequests = async (req, res) => {
  const { phone } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  if (!phone) {
    return fail(res, 'phone is required', 400, req);
  }

  try {
    // التحقق من وجود العميل
    const customer = await Customer.findOne({ phone });
    if (!customer) {
      return fail(res, 'customer not found', 404, req);
    }

    const { status } = req.query;
    const filter = { customerPhone: phone };

    if (status) {
      filter.status = status;
    }

    const [requests, total] = await Promise.all([
      ServiceRequest.find(filter)
        .select('-__v')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('acceptedBy', 'name phone serviceType city rating')
        .lean(),
      ServiceRequest.countDocuments(filter),
    ]);

    return ok(res, requests, {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('❌ getCustomerRequests error:', error);
    return fail(res, 'internal error', 500, req);
  }
};

// ============================================================================
// PATCH /api/customers/:phone - تحديث بيانات العميل
// ============================================================================
exports.updateCustomer = async (req, res) => {
  const { phone } = req.params;
  const { name, email, avatar, isActive } = req.body;

  if (!phone) {
    return fail(res, 'phone is required', 400, req);
  }

  try {
    const customer = await Customer.findOne({ phone });

    if (!customer) {
      return fail(res, 'customer not found', 404, req);
    }

    // تحديث الحقول المسموح بها
    if (name) customer.name = name;
    if (email !== undefined) customer.email = email;
    if (avatar !== undefined) customer.avatar = avatar;
    if (typeof isActive === 'boolean') customer.isActive = isActive;

    await customer.save();

    await logActivity('customer_update', req, {
      phone,
      updates: Object.keys(req.body),
    });

    // تنظيف الكاش
    clearCache(`customer:${phone}`);

    return ok(res, customer);
  } catch (error) {
    console.error('❌ updateCustomer error:', error);
    return fail(res, 'internal error', 500, req);
  }
};

// ============================================================================
// DELETE /api/customers/:phone - حذف (تعطيل) العميل
// ============================================================================
exports.deleteCustomer = async (req, res) => {
  const { phone } = req.params;

  if (!phone) {
    return fail(res, 'phone is required', 400, req);
  }

  try {
    const customer = await Customer.findOne({ phone });

    if (!customer) {
      return fail(res, 'customer not found', 404, req);
    }

    // تعطيل بدلاً من الحذف النهائي
    customer.isActive = false;
    await customer.save();

    await logActivity('customer_delete', req, { phone });

    // تنظيف الكاش
    clearCache(`customer:${phone}`);

    return ok(res, {
      message: 'customer deactivated successfully',
      customer,
    });
  } catch (error) {
    console.error('❌ deleteCustomer error:', error);
    return fail(res, 'internal error', 500, req);
  }
};

// ============================================================================
// GET /api/customers/stats - إحصائيات العملاء
// ============================================================================
exports.getCustomerStats = async (req, res) => {
  try {
    const cacheKey = 'customers:stats';
    const cached = getCache(cacheKey);

    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return ok(res, cached);
    }

    const [
      total,
      active,
      verified,
      withRequests,
      recentCustomers,
      topCustomers,
    ] = await Promise.all([
      // إجمالي العملاء
      Customer.countDocuments(),

      // العملاء النشطين
      Customer.countDocuments({ isActive: true }),

      // العملاء المُحققين
      Customer.countDocuments({ isVerified: true }),

      // العملاء اللي لديهم طلبات
      ServiceRequest.distinct('customerPhone'),

      // آخر 5 عملاء مسجلين
      Customer.find()
        .select('name phone createdAt')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),

      // أكثر العملاء طلبات
      ServiceRequest.aggregate([
        {
          $group: {
            _id: '$customerPhone',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
    ]);

    // جلب بيانات أكثر العملاء طلبات
    const topCustomersWithDetails = await Promise.all(
      topCustomers.map(async (item) => {
        const customer = await Customer.findOne({ phone: item._id })
          .select('name phone')
          .lean();
        return {
          ...customer,
          requestsCount: item.count,
        };
      })
    );

    const stats = {
      total,
      active,
      verified,
      withRequests: withRequests.length,
      inactive: total - active,
      recentCustomers,
      topCustomers: topCustomersWithDetails,
      updatedAt: new Date(),
    };

    setCache(cacheKey, stats, 5 * 60 * 1000); // 5 دقائق
    res.setHeader('X-Cache', 'MISS');

    return ok(res, stats);
  } catch (error) {
    console.error('❌ getCustomerStats error:', error);
    return fail(res, 'internal error', 500, req);
  }
};

// ============================================================================
// POST /api/customers/:phone/requests/count - تحديث عداد الطلبات
// ============================================================================
exports.incrementRequests = async (req, res) => {
  const { phone } = req.params;

  if (!phone) {
    return fail(res, 'phone is required', 400, req);
  }

  try {
    const customer = await Customer.findOne({ phone });

    if (!customer) {
      return fail(res, 'customer not found', 404, req);
    }

    await customer.incrementRequests();

    return ok(res, {
      message: 'request count updated',
      totalRequests: customer.totalRequests,
    });
  } catch (error) {
    console.error('❌ incrementRequests error:', error);
    return fail(res, 'internal error', 500, req);
  }
};

// ============================================================================
// GET /api/customers/search - بحث متقدم
// ============================================================================
exports.searchCustomers = async (req, res) => {
  const { q, minRequests, maxRequests, registeredAfter, registeredBefore } =
    req.query;

  try {
    const filter = {};

    // البحث النصي
    if (q) {
      filter.$or = [
        { name: new RegExp(q, 'i') },
        { phone: new RegExp(q, 'i') },
        { email: new RegExp(q, 'i') },
      ];
    }

    // فلترة حسب عدد الطلبات
    if (minRequests) {
      filter.totalRequests = { $gte: parseInt(minRequests) };
    }
    if (maxRequests) {
      filter.totalRequests = {
        ...filter.totalRequests,
        $lte: parseInt(maxRequests),
      };
    }

    // فلترة حسب تاريخ التسجيل
    if (registeredAfter || registeredBefore) {
      filter.createdAt = {};
      if (registeredAfter) {
        filter.createdAt.$gte = new Date(registeredAfter);
      }
      if (registeredBefore) {
        filter.createdAt.$lte = new Date(registeredBefore);
      }
    }

    const customers = await Customer.find(filter)
      .select('-__v')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return ok(res, customers, {
      total: customers.length,
      query: req.query,
    });
  } catch (error) {
    console.error('❌ searchCustomers error:', error);
    return fail(res, 'internal error', 500, req);
  }
};