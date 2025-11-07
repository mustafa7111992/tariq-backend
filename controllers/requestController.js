// controllers/requestController.js

const ServiceRequest = require("../models/ServiceRequest");
const ProviderSettings = require("../models/ProviderSettings");
const { ok, fail, getDistanceKm } = require("../utils/helpers");

// POST /api/requests
// إنشاء طلب خدمة
exports.createRequest = async (req, res) => {
  try {
    const { customerPhone, serviceType, notes, location, city } = req.body;

    if (!serviceType) {
      return fail(res, "serviceType is required", 400, req);
    }

    let geoLocation = null;
    if (location?.lat && location?.lng) {
      geoLocation = {
        type: "Point",
        coordinates: [location.lng, location.lat],
      };
    }

    const doc = await ServiceRequest.create({
      customerPhone: customerPhone || null,
      serviceType,
      notes: notes || "",
      city: city || null,
      status: "pending",
      location: geoLocation,
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

    const items = await ServiceRequest.find({ customerPhone: phone })
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

    const doc = await ServiceRequest.findById(id);
    if (!doc) return fail(res, "request not found", 404, req);

    if (phone && doc.customerPhone && phone !== doc.customerPhone) {
      return fail(res, "not your request", 403, req);
    }

    doc.status = "cancelled";
    doc.cancelledAt = new Date();
    await doc.save();

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

    // لو عنده طلب شغال رجّعه بس
    if (phone) {
      const active = await ServiceRequest.findOne({
        acceptedByPhone: phone,
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
    }

    // شوف إعدادات المزود
    maxKm = parseFloat(maxKm);
    if (phone) {
      const settings = await ProviderSettings.findOne({ phone }).lean();
      if (settings?.maxDistance) {
        maxKm = settings.maxDistance;
      }
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

    // تأكد ما عنده طلب شغال
    const active = await ServiceRequest.findOne({
      acceptedByPhone: providerPhone,
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

    if (doc.status !== "pending" && doc.acceptedByPhone !== providerPhone) {
      return fail(
        res,
        "request already accepted by another provider",
        409,
        req
      );
    }

    doc.status = "accepted";
    doc.acceptedByPhone = providerPhone;
    doc.acceptedAt = new Date();
    await doc.save();

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

    const doc = await ServiceRequest.findById(id);
    if (!doc) return fail(res, "request not found", 404, req);

    if (providerPhone && doc.acceptedByPhone !== providerPhone) {
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

    const doc = await ServiceRequest.findById(id);
    if (!doc) return fail(res, "request not found", 404, req);

    if (providerPhone && doc.acceptedByPhone !== providerPhone) {
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

    const doc = await ServiceRequest.findById(id);
    if (!doc) return fail(res, "request not found", 404, req);

    if (providerPhone && doc.acceptedByPhone !== providerPhone) {
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

    const doc = await ServiceRequest.findById(id);
    if (!doc) return fail(res, "request not found", 404, req);

    if (providerPhone && doc.acceptedByPhone !== providerPhone) {
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

    const doc = await ServiceRequest.findById(id);
    if (!doc) return fail(res, "request not found", 404, req);

    // لو تريد تتأكد اللي يقيّم هو نفس الزبون
    if (phone && doc.customerPhone && phone !== doc.customerPhone) {
      return fail(res, "not your request", 403, req);
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

    const doc = await ServiceRequest.findById(id);
    if (!doc) return fail(res, "request not found", 404, req);

    // لو تريد تتأكد اللي يقيّم هو المزود
    if (phone && doc.acceptedByPhone && phone !== doc.acceptedByPhone) {
      return fail(res, "not your request", 403, req);
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