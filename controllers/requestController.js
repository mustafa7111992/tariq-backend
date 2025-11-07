// controllers/requestController.js
const ServiceRequest = require("../models/ServiceRequest");
const ProviderSettings = require("../models/ProviderSettings");
const { ok, fail, getDistanceKm } = require("../utils/helpers");
const { logActivity } = require("../utils/activityLogger");
const { clearCache } = require("../utils/cache");

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

  ok(res, reqs, {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
  });
};

exports.getRequestsByPhone = async (req, res) => {
  const { phone } = req.query;
  const reqs = await ServiceRequest.find({ customerPhone: phone })
    .sort({ createdAt: -1 })
    .lean();
  ok(res, reqs);
};

exports.cancelByCustomer = async (req, res) => {
  const { id } = req.params;
  const { phone } = req.body;

  const reqDoc = await ServiceRequest.findById(id);
  if (!reqDoc) return fail(res, "request not found", 404, req.id);

  if (phone && reqDoc.customerPhone && reqDoc.customerPhone !== phone) {
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

  ok(res, reqDoc);
};

exports.getForProvider = async (req, res) => {
  const { lat, lng, serviceType, phone, maxKm = 30 } = req.query;

  // لو عنده طلب شغال رجعه
  if (phone) {
    const activeReq = await ServiceRequest.findOne({
      acceptedByPhone: phone,
      status: { $in: ["accepted", "on-the-way", "in-progress"] },
    })
      .sort({ createdAt: -1 })
      .lean();

    if (activeReq) {
      const obj = { ...activeReq };
      if (obj.location?.coordinates) {
        const [lng2, lat2] = obj.location.coordinates;
        obj.location = { lat: lat2, lng: lng2 };
      }
      return ok(res, [obj]);
    }
  }

  let maxDistance = parseFloat(maxKm);
  if (phone) {
    const settings = await ProviderSettings.findOne({ phone });
    if (settings?.maxDistance) maxDistance = settings.maxDistance;
  }

  // استعلام جغرافي
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

  const formatted = nearby.map((r) => {
    const obj = { ...r };
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

  ok(res, formatted);
};

exports.acceptRequest = async (req, res) => {
  const { id } = req.params;
  const { providerPhone } = req.body;

  const active = await ServiceRequest.findOne({
    acceptedByPhone: providerPhone,
    status: { $in: ["accepted", "on-the-way", "in-progress"] },
  });
  if (active) {
    return fail(
      res,
      "you already have active request, finish it first",
      400,
      req.id
    );
  }

  const reqDoc = await ServiceRequest.findById(id);
  if (!reqDoc) return fail(res, "request not found", 404, req.id);

  if (
    reqDoc.status !== "pending" &&
    reqDoc.acceptedByPhone &&
    reqDoc.acceptedByPhone !== providerPhone
  ) {
    return fail(res, "request already accepted by another provider", 409, req.id);
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

  ok(res, reqDoc);
};

exports.markOnTheWay = async (req, res) => {
  const { id } = req.params;
  const { providerPhone } = req.body;

  const reqDoc = await ServiceRequest.findById(id);
  if (!reqDoc) return fail(res, "request not found", 404, req.id);
  if (providerPhone && reqDoc.acceptedByPhone !== providerPhone)
    return fail(res, "not your request", 403, req.id);

  reqDoc.status = "on-the-way";
  await reqDoc.save();
  await logActivity(req, "request_on_the_way", { requestId: id });
  clearCache("requests:");
  ok(res, reqDoc);
};

exports.markInProgress = async (req, res) => {
  const { id } = req.params;
  const { providerPhone } = req.body;

  const reqDoc = await ServiceRequest.findById(id);
  if (!reqDoc) return fail(res, "request not found", 404, req.id);
  if (providerPhone && reqDoc.acceptedByPhone !== providerPhone)
    return fail(res, "not your request", 403, req.id);

  reqDoc.status = "in-progress";
  await reqDoc.save();
  await logActivity(req, "request_in_progress", { requestId: id });
  clearCache("requests:");
  ok(res, reqDoc);
};

exports.completeRequest = async (req, res) => {
  const { id } = req.params;
  const { providerPhone } = req.body;

  const reqDoc = await ServiceRequest.findById(id);
  if (!reqDoc) return fail(res, "request not found", 404, req.id);
  if (providerPhone && reqDoc.acceptedByPhone !== providerPhone)
    return fail(res, "not your request", 403, req.id);

  reqDoc.status = "done";
  reqDoc.completedAt = new Date();
  await reqDoc.save();

  await logActivity(req, "request_completed", { requestId: id });
  clearCache("requests:");
  clearCache("provider:stats:" + providerPhone);

  ok(res, reqDoc);
};

exports.cancelByProvider = async (req, res) => {
  const { id } = req.params;
  const { providerPhone } = req.body;

  const reqDoc = await ServiceRequest.findById(id);
  if (!reqDoc) return fail(res, "request not found", 404, req.id);
  if (providerPhone && reqDoc.acceptedByPhone !== providerPhone)
    return fail(res, "not your request", 403, req.id);

  reqDoc.status = "cancelled";
  reqDoc.acceptedByPhone = null;
  reqDoc.cancelledAt = new Date();
  await reqDoc.save();

  await logActivity(req, "request_cancelled", {
    requestId: id,
    cancelledBy: "provider",
  });
  clearCache("requests:");

  ok(res, reqDoc);
};

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

  ok(res, reqDoc);
};

exports.rateCustomer = async (req, res) => {
  const { id } = req.params;
  const { score, comment, phone } = req.body;

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
  ok(res, reqDoc);
};