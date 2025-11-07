// controllers/requestController.js
const ServiceRequest = require("../models/ServiceRequest");
const ProviderSettings = require("../models/ProviderSettings");
const { ok, fail, getDistanceKm } = require("../utils/helpers");
const { logActivity } = require("../utils/activityLogger");
const { getCache, setCache, clearCache } = require("../utils/cache");

// إنشاء طلب
exports.createRequest = async (req, res) => {
  const { serviceType, notes, location, city, customerPhone } = req.body;

  let geoLocation = null;
  if (location?.lat && location?.lng) {
    geoLocation = {
      type: "Point",
      coordinates: [location.lng, location.lat],
    };
  }

  const doc = await ServiceRequest.create({
    serviceType,
    notes: notes || "",
    location: geoLocation,
    city: city || null,
    customerPhone: customerPhone || null,
  });

  await logActivity(req, "request_created", {
    requestId: doc._id,
    serviceType,
  });

  clearCache("requests:");
  return ok(res, doc);
};

// جلب الطلبات (عام)
exports.getRequests = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const skip = (page - 1) * limit;
  const { status, serviceType } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (serviceType) filter.serviceType = serviceType;

  const [reqs, total] = await Promise.all([
    ServiceRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ServiceRequest.countDocuments(filter),
  ]);

  return ok(res, reqs, {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
  });
};

// طلبات حسب رقم الزبون
exports.getRequestsByPhone = async (req, res) => {
  const { phone } = req.query;
  const reqs = await ServiceRequest.find({ customerPhone: phone })
    .sort({ createdAt: -1 })
    .lean();
  return ok(res, reqs);
};

// إلغاء من الزبون
exports.cancelByCustomer = async (req, res) => {
  const { id } = req.params;
  const { phone } = req.body;

  const reqDoc = await ServiceRequest.findById(id);
  if (!reqDoc) return fail(res, "request not found", 404, req.id);

  if (phone && reqDoc.customerPhone && phone !== reqDoc.customerPhone) {
    return fail(res, "not your request", 403, req.id);
  }

  reqDoc.status = "cancelled";
  reqDoc.cancelledAt = new Date();
  await reqDoc.save();

  await logActivity(req, "request_cancelled", {
    requestId: id,
    cancelledBy: "customer",
  });

  clearCache("requests:");
  return ok(res, reqDoc);
};

// الطلبات للمزوّد (قريبة أو طلبه النشط)
exports.getForProvider = async (req, res) => {
  const { lat, lng, serviceType, phone, maxKm = 30 } = req.query;

  // لو عنده طلب شغال رجع هذا الطلب بس
  if (phone) {
    const activeReq = await ServiceRequest.findOne({
      acceptedByPhone: phone,
      status: { $in: ["accepted", "on-the-way", "in-progress"] },
    })
      .sort({ createdAt: -1 })
      .lean();

    if (activeReq) {
      // رجّع اللوكيشن بشكل {lat,lng}
      if (activeReq.location?.coordinates) {
        activeReq.location = {
          lat: activeReq.location.coordinates[1],
          lng: activeReq.location.coordinates[0],
        };
      }
      return ok(res, [activeReq]);
    }
  }

  // ما عنده طلب شغال، ندور طلبات قريبة
  let maxDistance = parseFloat(maxKm);
  if (phone) {
    const settings = await ProviderSettings.findOne({ phone });
    if (settings?.maxDistance) maxDistance = settings.maxDistance;
  }

  // نستعمل geo لو موجود
  const query = {
    status: "pending",
    location: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [parseFloat(lng), parseFloat(lat)],
        },
        $maxDistance: maxDistance * 1000,
      },
    },
  };
  if (serviceType) query.serviceType = serviceType;

  const nearby = await ServiceRequest.find(query).limit(20).lean();

  const formatted = nearby.map((reqDoc) => {
    const obj = { ...reqDoc };
    if (obj.location?.coordinates) {
      const [lng2, lat2] = obj.location.coordinates;
      obj.location = { lat: lat2, lng: lng2 };
      obj.distance = getDistanceKm(
        parseFloat(lat),
        parseFloat(lng),
        lat2,
        lng2
      );
    }
    return obj;
  });

  return ok(res, formatted);
};

// قبول طلب
exports.acceptRequest = async (req, res) => {
  const { id } = req.params;
  const { providerPhone } = req.body;

  // تأكد المزود ما عنده طلب شغال
  const activeForThisProvider = await ServiceRequest.findOne({
    acceptedByPhone: providerPhone,
    status: { $in: ["accepted", "on-the-way", "in-progress"] },
  });
  if (activeForThisProvider) {
    return fail(
      res,
      "you already have active request, finish it first",
      400,
      req.id
    );
  }

  const reqDoc = await ServiceRequest.findById(id);
  if (!reqDoc) return fail(res, "request not found", 404, req.id);

  // لو الطلب مو pending وتقبله واحد ثاني
  if (
    reqDoc.status !== "pending" &&
    reqDoc.acceptedByPhone &&
    reqDoc.acceptedByPhone !== providerPhone
  ) {
    return fail(
      res,
      "request already accepted by another provider",
      409,
      req.id
    );
  }

  reqDoc.status = "accepted";
  reqDoc.acceptedByPhone = providerPhone;
  reqDoc.acceptedAt = new Date();
  await reqDoc.save();

  await logActivity(req, "request_accepted", {
    requestId: id,
    providerPhone,
  });
  clearCache("requests:");

  return ok(res, reqDoc);
};

// في الطريق
exports.markOnTheWay = async (req, res) => {
  const { id } = req.params;
  const { providerPhone } = req.body || {};

  const reqDoc = await ServiceRequest.findById(id);
  if (!reqDoc) return fail(res, "request not found", 404, req.id);

  if (providerPhone && reqDoc.acceptedByPhone !== providerPhone) {
    return fail(res, "not your request", 403, req.id);
  }

  reqDoc.status = "on-the-way";
  await reqDoc.save();

  await logActivity(req, "request_on_the_way", { requestId: id });
  clearCache("requests:");
  return ok(res, reqDoc);
};

// قيد التنفيذ
exports.markInProgress = async (req, res) => {
  const { id } = req.params;
  const { providerPhone } = req.body || {};

  const reqDoc = await ServiceRequest.findById(id);
  if (!reqDoc) return fail(res, "request not found", 404, req.id);

  if (providerPhone && reqDoc.acceptedByPhone !== providerPhone) {
    return fail(res, "not your request", 403, req.id);
  }

  reqDoc.status = "in-progress";
  await reqDoc.save();

  await logActivity(req, "request_in_progress", { requestId: id });
  clearCache("requests:");
  return ok(res, reqDoc);
};

// إنهاء الطلب
exports.completeRequest = async (req, res) => {
  const { id } = req.params;
  const { providerPhone } = req.body || {};

  const reqDoc = await ServiceRequest.findById(id);
  if (!reqDoc) return fail(res, "request not found", 404, req.id);

  if (providerPhone && reqDoc.acceptedByPhone !== providerPhone) {
    return fail(res, "not your request", 403, req.id);
  }

  reqDoc.status = "done";
  reqDoc.completedAt = new Date();
  await reqDoc.save();

  await logActivity(req, "request_completed", { requestId: id });
  clearCache("requests:");
  clearCache("provider:stats:" + reqDoc.acceptedByPhone);

  return ok(res, reqDoc);
};

// إلغاء من المزوّد
exports.cancelByProvider = async (req, res) => {
  const { id } = req.params;
  const { providerPhone } = req.body || {};

  const reqDoc = await ServiceRequest.findById(id);
  if (!reqDoc) return fail(res, "request not found", 404, req.id);

  if (providerPhone && reqDoc.acceptedByPhone !== providerPhone) {
    return fail(res, "not your request", 403, req.id);
  }

  reqDoc.status = "cancelled";
  reqDoc.acceptedByPhone = null;
  reqDoc.cancelledAt = new Date();
  await reqDoc.save();

  await logActivity(req, "request_cancelled", {
    requestId: id,
    cancelledBy: "provider",
  });
  clearCache("requests:");

  return ok(res, reqDoc);
};

// تقييم المزود من الزبون
exports.rateProvider = async (req, res) => {
  const { id } = req.params;
  const { score, comment, phone } = req.body;

  const reqDoc = await ServiceRequest.findById(id);
  if (!reqDoc) return fail(res, "request not found", 404, req.id);

  if (phone && reqDoc.customerPhone && phone !== reqDoc.customerPhone) {
    return fail(res, "not your request", 403, req.id);
  }

  reqDoc.providerRating = {
    score,
    comment: comment || "",
    ratedAt: new Date(),
  };
  await reqDoc.save();

  await logActivity(req, "provider_rated", { requestId: id, score });
  clearCache("provider:stats:" + reqDoc.acceptedByPhone);

  return ok(res, reqDoc);
};

// تقييم الزبون من المزوّد
exports.rateCustomer = async (req, res) => {
  const { id } = req.params;
  const { score, comment, phone } = req.body;
  if (!score) return fail(res, "score is required", 400, req.id);

  const reqDoc = await ServiceRequest.findById(id);
  if (!reqDoc) return fail(res, "request not found", 404, req.id);

  if (phone && reqDoc.acceptedByPhone && phone !== reqDoc.acceptedByPhone) {
    return fail(res, "not your request", 403, req.id);
  }

  reqDoc.customerRating = {
    score,
    comment: comment || "",
    ratedAt: new Date(),
  };
  await reqDoc.save();

  await logActivity(req, "customer_rated", { requestId: id, score });
  return ok(res, reqDoc);
};

// 👇 مهم جداً: لازم نصدّر الكل
module.exports = {
  createRequest,
  getRequests,
  getRequestsByPhone,
  cancelByCustomer,
  getForProvider,
  acceptRequest,
  markOnTheWay,
  markInProgress,
  completeRequest,
  cancelByProvider,
  rateProvider,
  rateCustomer,
};