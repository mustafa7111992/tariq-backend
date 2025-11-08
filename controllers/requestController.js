// controllers/requestController.js

const ServiceRequest = require("../models/ServiceRequest");
const ProviderSettings = require("../models/ProviderSettings");
const User = require("../models/User");
const { ok, fail, getDistanceKm } = require("../utils/helpers");
const { logActivity } = require("../utils/activityLogger");

// توحيد وتحقق من صحة الرقم - نفس اللي في whatsappController
function normalizePhone(raw) {
  if (!raw) return null;
  const p = raw.trim().replace(/\s+/g, ''); // إزالة المسافات
  
  // الأرقام العراقية التي تبدأ بـ 07
  if (p.startsWith('07')) {
    const phone = `+964${p.slice(1)}`;
    return phone;
  }
  
  // الأرقام التي تبدأ بـ +
  if (p.startsWith('+')) {
    // التحقق من أن الرقم يحتوي على أرقام فقط بعد +
    if (!/^\+[0-9]+$/.test(p)) {
      return null;
    }
    return p;
  }
  
  // أي رقم آخر نرجعه كما هو بعد التحقق من أنه أرقام فقط
  if (!/^[0-9]+$/.test(p)) {
    return null;
  }
  
  return p;
}

// Helper functions للتحقق من الصحة
async function validateCustomer(phone) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return { valid: false, error: 'invalid phone format' };
  }
  
  const user = await User.findOne({ phone: normalizedPhone, role: 'customer' });
  if (!user) {
    return { valid: false, error: 'customer not found' };
  }
  return { valid: true, user, normalizedPhone };
}

async function validateProvider(phone) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return { valid: false, error: 'invalid phone format' };
  }
  
  const user = await User.findOne({ phone: normalizedPhone, role: 'provider' });
  if (!user) {
    return { valid: false, error: 'provider not found' };
  }
  return { valid: true, user, normalizedPhone };
}

// POST /api/requests
// إنشاء طلب خدمة
exports.createRequest = async (req, res) => {
  try {
    const { customerPhone, serviceType, notes, location, city } = req.body;

    if (!serviceType) {
      return fail(res, "serviceType is required", 400, req);
    }

    // التحقق من المستخدم إذا تم تمرير رقم الهاتف
    if (customerPhone) {
      const validation = await validateCustomer(customerPhone);
      if (!validation.valid) {
        return fail(res, validation.error, 404, req);
      }
    }

    const normalizedCustomerPhone = customerPhone ? normalizePhone(customerPhone) : null;

    let geoLocation = null;
    if (location?.lat && location?.lng) {
      // التحقق من صحة الإحداثيات
      const lat = parseFloat(location.lat);
      const lng = parseFloat(location.lng);
      
      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return fail(res, "invalid coordinates", 400, req);
      }

      geoLocation = {
        type: "Point",
        coordinates: [lng, lat],
      };
    }

    const doc = await ServiceRequest.create({
      customerPhone: normalizedCustomerPhone,
      serviceType,
      notes: notes || "",
      city: city || null,
      status: "pending",
      location: geoLocation,
    });

    await logActivity("request_created", req, { 
      requestId: doc._id, 
      serviceType,
      customerPhone: normalizedCustomerPhone 
    });

    return ok(res, doc);
  } catch (err) {
    console.error("createRequest error:", err);
    return fail(res, "internal error", 500, req);
  }
};

// GET /api/requests
// جلب الطلبات مع فلترة بسيطة + صفحة
exports.getRequests = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.serviceType) filter.serviceType = req.query.serviceType;

    const [items, total] = await Promise.all([
      ServiceRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ServiceRequest.countDocuments(filter),
    ]);

    return ok(res, items, {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("getRequests error:", err);
    return fail(res, "internal error", 500, req);
  }
};

// GET /api/requests/by-phone?phone=...
exports.getRequestsByPhone = async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) return fail(res, "phone is required", 400, req);

    // توحيد وتحقق من المستخدم
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      return fail(res, "invalid phone format", 400, req);
    }

    const user = await User.findOne({ phone: normalizedPhone });
    if (!user) {
      return fail(res, "user not found", 404, req);
    }

    let filter = {};
    
    // حسب دور المستخدم نحدد الفلتر
    if (user.role === 'customer') {
      filter.customerPhone = normalizedPhone;
    } else if (user.role === 'provider') {
      filter.acceptedByPhone = normalizedPhone;
    } else {
      return fail(res, "invalid user role", 400, req);
    }

    const items = await ServiceRequest.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    return ok(res, items);
  } catch (err) {
    console.error("getRequestsByPhone error:", err);
    return fail(res, "internal error", 500, req);
  }
};

// POST /api/requests/:id/cancel  (by customer)
exports.cancelByCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { phone } = req.body || {};

    if (!phone) return fail(res, "phone is required", 400, req);

    // التحقق من المستخدم
    const validation = await validateCustomer(phone);
    if (!validation.valid) {
      return fail(res, validation.error, 404, req);
    }

    const doc = await ServiceRequest.findById(id);
    if (!doc) return fail(res, "request not found", 404, req);

    // التحقق من الملكية
    if (doc.customerPhone !== validation.normalizedPhone) {
      return fail(res, "not your request", 403, req);
    }

    // التحقق من إمكانية الإلغاء
    if (doc.status === 'done') {
      return fail(res, "cannot cancel completed request", 400, req);
    }

    if (doc.status === 'cancelled') {
      return fail(res, "request already cancelled", 400, req);
    }

    doc.status = "cancelled";
    doc.cancelledAt = new Date();
    await doc.save();

    await logActivity("request_cancelled_by_customer", req, { 
      requestId: doc._id,
      customerId: validation.user._id 
    });

    return ok(res, doc);
  } catch (err) {
    console.error("cancelByCustomer error:", err);
    return fail(res, "internal error", 500, req);
  }
};

// GET /api/requests/for-provider
// ترجع الطلبات القريبة من المزود
exports.getForProvider = async (req, res) => {
  try {
    const { lat, lng, serviceType, phone } = req.query;
    let { maxKm = 30 } = req.query;

    if (!phone) return fail(res, "phone is required", 400, req);

    // التحقق من المزود
    const validation = await validateProvider(phone);
    if (!validation.valid) {
      return fail(res, validation.error, 404, req);
    }

    // لو عنده طلب شغال رجّعه بس
    const active = await ServiceRequest.findOne({
      acceptedByPhone: validation.normalizedPhone,
      status: { $in: ["accepted", "on-the-way", "in-progress"] },
    })
      .sort({ createdAt: -1 })
      .lean();

    if (active) {
      const one = { ...active };
      if (one.location?.coordinates) {
        one.location = {
          lng: one.location.coordinates[0],
          lat: one.location.coordinates[1],
        };
      }
      return ok(res, [one]);
    }

    // شوف إعدادات المزود
    maxKm = parseFloat(maxKm);
    const settings = await ProviderSettings.findOne({ phone: validation.normalizedPhone }).lean();
    if (settings?.maxDistance) {
      maxKm = settings.maxDistance;
    }

    // التحقق من أن المزود online
    if (settings && !settings.isOnline) {
      return ok(res, [], { message: "provider is offline" });
    }

    const baseFilter = {
      status: "pending",
    };
    if (serviceType) baseFilter.serviceType = serviceType;

    let nearby = [];

    // نحاول geoNear أول
    if (lat && lng) {
      const geoQuery = {
        ...baseFilter,
        location: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [parseFloat(lng), parseFloat(lat)],
            },
            $maxDistance: maxKm * 1000,
          },
        },
      };

      try {
        nearby = await ServiceRequest.find(geoQuery).limit(20).lean();
      } catch (err) {
        // هنا المشكلة اللي طلعتلك على Render: مافي index
        console.error(
          "geo query failed, fallback to normal find:",
          err.message
        );
        nearby = await ServiceRequest.find(baseFilter)
          .sort({ createdAt: -1 })
          .limit(20)
          .lean();
      }
    } else {
      // ماكو إحداثيات – رجع pending عادي
      nearby = await ServiceRequest.find(baseFilter)
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();
    }

    // صياغة الرد + حساب المسافة
    const list = nearby.map((r) => {
      const obj = { ...r };
      if (obj.location?.coordinates) {
        const [lo, la] = obj.location.coordinates;
        obj.location = { lat: la, lng: lo };
        if (lat && lng) {
          obj.distance = getDistanceKm(
            parseFloat(lat),
            parseFloat(lng),
            la,
            lo
          );
        }
      }
      return obj;
    });

    return ok(res, list);
  } catch (err) {
    console.error("getForProvider error:", err);
    return fail(res, "internal error", 500, req);
  }
};

// PATCH /api/requests/:id/accept
exports.acceptRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { providerPhone } = req.body;

    if (!providerPhone)
      return fail(res, "providerPhone is required", 400, req);

    // التحقق من المزود
    const validation = await validateProvider(providerPhone);
    if (!validation.valid) {
      return fail(res, validation.error, 404, req);
    }

    // تأكد ما عنده طلب شغال
    const active = await ServiceRequest.findOne({
      acceptedByPhone: validation.normalizedPhone,
      status: { $in: ["accepted", "on-the-way", "in-progress"] },
    });
    if (active) {
      return fail(
        res,
        "you already have active request, finish it first",
        400,
        req
      );
    }

    const doc = await ServiceRequest.findById(id);
    if (!doc) return fail(res, "request not found", 404, req);

    if (doc.status !== "pending") {
      return fail(
        res,
        "request already accepted by another provider",
        409,
        req
      );
    }

    doc.status = "accepted";
    doc.acceptedByPhone = validation.normalizedPhone;
    doc.acceptedAt = new Date();
    await doc.save();

    await logActivity("request_accepted", req, { 
      requestId: doc._id,
      providerId: validation.user._id 
    });

    return ok(res, doc);
  } catch (err) {
    console.error("acceptRequest error:", err);
    return fail(res, "internal error", 500, req);
  }
};

// PATCH /api/requests/:id/on-the-way
exports.markOnTheWay = async (req, res) => {
  try {
    const { id } = req.params;
    const { providerPhone } = req.body || {};

    if (!providerPhone) return fail(res, "providerPhone is required", 400, req);

    // التحقق من المزود
    const validation = await validateProvider(providerPhone);
    if (!validation.valid) {
      return fail(res, validation.error, 404, req);
    }

    const doc = await ServiceRequest.findById(id);
    if (!doc) return fail(res, "request not found", 404, req);

    if (doc.acceptedByPhone !== validation.normalizedPhone) {
      return fail(res, "not your request", 403, req);
    }

    doc.status = "on-the-way";
    await doc.save();

    return ok(res, doc);
  } catch (err) {
    console.error("markOnTheWay error:", err);
    return fail(res, "internal error", 500, req);
  }
};

// PATCH /api/requests/:id/in-progress
exports.markInProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const { providerPhone } = req.body || {};

    if (!providerPhone) return fail(res, "providerPhone is required", 400, req);

    // التحقق من المزود
    const validation = await validateProvider(providerPhone);
    if (!validation.valid) {
      return fail(res, validation.error, 404, req);
    }

    const doc = await ServiceRequest.findById(id);
    if (!doc) return fail(res, "request not found", 404, req);

    if (doc.acceptedByPhone !== validation.normalizedPhone) {
      return fail(res, "not your request", 403, req);
    }

    doc.status = "in-progress";
    await doc.save();

    return ok(res, doc);
  } catch (err) {
    console.error("markInProgress error:", err);
    return fail(res, "internal error", 500, req);
  }
};

// PATCH /api/requests/:id/complete
exports.completeRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { providerPhone } = req.body || {};

    if (!providerPhone) return fail(res, "providerPhone is required", 400, req);

    // التحقق من المزود
    const validation = await validateProvider(providerPhone);
    if (!validation.valid) {
      return fail(res, validation.error, 404, req);
    }

    const doc = await ServiceRequest.findById(id);
    if (!doc) return fail(res, "request not found", 404, req);

    if (doc.acceptedByPhone !== validation.normalizedPhone) {
      return fail(res, "not your request", 403, req);
    }

    doc.status = "done";
    doc.completedAt = new Date();
    await doc.save();

    return ok(res, doc);
  } catch (err) {
    console.error("completeRequest error:", err);
    return fail(res, "internal error", 500, req);
  }
};

// PATCH /api/requests/:id/cancel-by-provider
exports.cancelByProvider = async (req, res) => {
  try {
    const { id } = req.params;
    const { providerPhone } = req.body || {};

    if (!providerPhone) return fail(res, "providerPhone is required", 400, req);

    // التحقق من المزود
    const validation = await validateProvider(providerPhone);
    if (!validation.valid) {
      return fail(res, validation.error, 404, req);
    }

    const doc = await ServiceRequest.findById(id);
    if (!doc) return fail(res, "request not found", 404, req);

    if (doc.acceptedByPhone !== validation.normalizedPhone) {
      return fail(res, "not your request", 403, req);
    }

    doc.status = "cancelled";
    doc.cancelledAt = new Date();
    doc.acceptedByPhone = null;
    await doc.save();

    return ok(res, doc);
  } catch (err) {
    console.error("cancelByProvider error:", err);
    return fail(res, "internal error", 500, req);
  }
};

// POST /api/requests/:id/rate-provider
exports.rateProvider = async (req, res) => {
  try {
    const { id } = req.params;
    const { score, comment, phone } = req.body || {};

    if (!phone) return fail(res, "phone is required", 400, req);
    if (!score || score < 1 || score > 5) return fail(res, "score must be between 1 and 5", 400, req);

    // التحقق من المستخدم
    const validation = await validateCustomer(phone);
    if (!validation.valid) {
      return fail(res, validation.error, 404, req);
    }

    const doc = await ServiceRequest.findById(id);
    if (!doc) return fail(res, "request not found", 404, req);

    // التحقق من الملكية
    if (doc.customerPhone !== validation.normalizedPhone) {
      return fail(res, "not your request", 403, req);
    }

    // التحقق من أن الطلب مكتمل
    if (doc.status !== 'done') {
      return fail(res, "can only rate completed requests", 400, req);
    }

    doc.providerRating = {
      score,
      comment: comment || "",
      ratedAt: new Date(),
    };
    await doc.save();

    return ok(res, doc);
  } catch (err) {
    console.error("rateProvider error:", err);
    return fail(res, "internal error", 500, req);
  }
};

// POST /api/requests/:id/rate-customer
exports.rateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { score, comment, phone } = req.body || {};

    if (!phone) return fail(res, "phone is required", 400, req);
    if (!score || score < 1 || score > 5) return fail(res, "score must be between 1 and 5", 400, req);

    // التحقق من المزود
    const validation = await validateProvider(phone);
    if (!validation.valid) {
      return fail(res, validation.error, 404, req);
    }

    const doc = await ServiceRequest.findById(id);
    if (!doc) return fail(res, "request not found", 404, req);

    // التحقق من الملكية
    if (doc.acceptedByPhone !== validation.normalizedPhone) {
      return fail(res, "not your request", 403, req);
    }

    // التحقق من أن الطلب مكتمل
    if (doc.status !== 'done') {
      return fail(res, "can only rate completed requests", 400, req);
    }

    doc.customerRating = {
      score,
      comment: comment || "",
      ratedAt: new Date(),
    };
    await doc.save();

    return ok(res, doc);
  } catch (err) {
    console.error("rateCustomer error:", err);
    return fail(res, "internal error", 500, req);
  }
};