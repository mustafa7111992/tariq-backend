// controllers/providerController.js
const ProviderSettings = require("../models/ProviderSettings");
const ServiceRequest = require("../models/ServiceRequest");
const { ok, fail } = require("../utils/helpers");
const { logActivity } = require("../utils/activityLogger");
const { getCache, setCache } = require("../utils/cache");

exports.getSettings = async (req, res) => {
  const { phone } = req.query;
  if (!phone) return fail(res, "phone is required", 400, req.id);

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
  ok(res, doc);
};

exports.updateSettings = async (req, res) => {
  const { phone } = req.body;
  if (!phone) return fail(res, "phone is required", 400, req.id);

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

  ok(res, doc);
};

exports.updateStatus = async (req, res) => {
  const { phone, status } = req.body;
  if (!phone) return fail(res, "phone is required", 400, req.id);
  if (!status) return fail(res, "status is required", 400, req.id);

  const isOnline = status === "online";

  const doc = await ProviderSettings.findOneAndUpdate(
    { phone },
    { isOnline },
    { upsert: true, new: true }
  );

  await logActivity(req, "provider_status_change", { status });
  ok(res, doc);
};

exports.updateLocation = async (req, res) => {
  const { phone, lat, lng } = req.body;
  if (!phone) return fail(res, "phone is required", 400, req.id);

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

  ok(res, doc);
};

exports.getStats = async (req, res) => {
  const { phone } = req.query;
  if (!phone) return fail(res, "phone is required", 400, req.id);

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
  ok(res, stats);
};