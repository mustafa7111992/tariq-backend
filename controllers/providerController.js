// controllers/providerController.js

const ProviderSettings = require("../models/ProviderSettings");
const ServiceRequest = require("../models/ServiceRequest");
const { ok, fail } = require("../utils/helpers");
const { logActivity } = require("../utils/activityLogger");
const { getCache, setCache, clearCache } = require("../utils/cache");

// GET /api/provider/settings?phone=...
exports.getSettings = async (req, res) => {
  const { phone } = req.query;
  if (!phone) return fail(res, "phone is required", 400, req);

  const doc = await ProviderSettings.findOne({ phone }).lean();
  if (!doc) {
    return ok(res, {
      phone,
      notificationsEnabled: true,
      soundEnabled: true,
      maxDistance: 30,
      isOnline: true,
    });
  }
  return ok(res, doc);
};

// POST /api/provider/settings
exports.updateSettings = async (req, res) => {
  const { phone } = req.body;
  if (!phone) return fail(res, "phone is required", 400, req);

  const doc = await ProviderSettings.findOneAndUpdate(
    { phone },
    {
      notificationsEnabled:
        typeof req.body.notificationsEnabled === "boolean"
          ? req.body.notificationsEnabled
          : true,
      soundEnabled:
        typeof req.body.soundEnabled === "boolean"
          ? req.body.soundEnabled
          : true,
      maxDistance: req.body.maxDistance ?? 30,
      isOnline:
        typeof req.body.isOnline === "boolean" ? req.body.isOnline : true,
    },
    { upsert: true, new: true }
  );

  // ممكن تنظف كاش الإحصائيات
  clearCache(`provider:stats:${phone}`);

  return ok(res, doc);
};

// POST /api/provider/status
exports.updateStatus = async (req, res) => {
  const { phone, status } = req.body;
  if (!phone) return fail(res, "phone is required", 400, req);
  if (!status) return fail(res, "status is required", 400, req);

  const isOnline = status === "online";

  const doc = await ProviderSettings.findOneAndUpdate(
    { phone },
    { isOnline },
    { upsert: true, new: true }
  );

  await logActivity("provider_status_change", req, { status });

  return ok(res, doc);
};

// POST /api/provider/location
exports.updateLocation = async (req, res) => {
  const { phone, lat, lng } = req.body;
  if (!phone) return fail(res, "phone is required", 400, req);
  if (lat == null || lng == null)
    return fail(res, "lat and lng are required", 400, req);

  const location = {
    type: "Point",
    coordinates: [parseFloat(lng), parseFloat(lat)],
  };

  const doc = await ProviderSettings.findOneAndUpdate(
    { phone },
    {
      currentLocation: location,
      lastLocationUpdate: new Date(),
    },
    { upsert: true, new: true }
  );

  return ok(res, doc);
};

// GET /api/provider/stats?phone=...
exports.getStats = async (req, res) => {
  const { phone } = req.query;
  if (!phone) return fail(res, "phone is required", 400, req);

  const cacheKey = `provider:stats:${phone}`;
  const cached = getCache(cacheKey);
  if (cached) {
    res.setHeader("X-Cache", "HIT");
    return ok(res, cached);
  }

  const [total, done, active, cancelled, rated] = await Promise.all([
    ServiceRequest.countDocuments({ acceptedByPhone: phone }),
    ServiceRequest.countDocuments({ acceptedByPhone: phone, status: "done" }),
    ServiceRequest.countDocuments({
      acceptedByPhone: phone,
      status: { $in: ["accepted", "on-the-way", "in-progress"] },
    }),
    ServiceRequest.countDocuments({
      acceptedByPhone: phone,
      status: "cancelled",
    }),
    ServiceRequest.find({
      acceptedByPhone: phone,
      "providerRating.score": { $exists: true },
    })
      .select("providerRating.score")
      .lean(),
  ]);

  let avgRating = null;
  let ratingCount = 0;

  if (rated.length > 0) {
    avgRating =
      rated.reduce((sum, r) => sum + r.providerRating.score, 0) /
      rated.length;
    avgRating = Math.round(avgRating * 10) / 10;
    ratingCount = rated.length;
  }

  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

  const stats = {
    phone,
    total,
    done,
    active,
    cancelled,
    avgRating,
    ratingCount,
    completionRate,
  };

  setCache(cacheKey, stats, 2 * 60 * 1000);
  res.setHeader("X-Cache", "MISS");

  return ok(res, stats);
};