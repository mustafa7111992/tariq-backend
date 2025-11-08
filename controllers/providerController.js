// controllers/providerController.js

const ProviderSettings = require("../models/ProviderSettings");
const ServiceRequest = require("../models/ServiceRequest");
const User = require("../models/User");
const { ok, fail } = require("../utils/helpers");
const { logActivity } = require("../utils/activityLogger");
const { getCache, setCache, clearCache } = require("../utils/cache");

// نفس الفكرة اللي بالواتساب: نوحّد شكل الرقم
function normalizePhone(raw) {
  if (!raw) return null;
  const p = raw.trim().replace(/\s+/g, "");

  // لو عراقي 07...
  if (p.startsWith("07")) {
    return `+964${p.slice(1)}`;
  }

  // لو دولي
  if (p.startsWith("+")) {
    if (!/^\+[0-9]+$/.test(p)) return null;
    return p;
  }

  // رقم عادي بس أرقام
  if (!/^[0-9]+$/.test(p)) return null;
  return p;
}

// Helper للتحقق من صحة Provider
async function validateProvider(phone, userId = null) {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    return { valid: false, error: "invalid phone" };
  }

  const user = await User.findOne({ phone: normalized, role: "provider" });
  if (!user) {
    return { valid: false, error: "provider not found" };
  }
  if (userId && user._id.toString() !== userId) {
    return { valid: false, error: "unauthorized" };
  }
  return { valid: true, user, phone: normalized };
}

// GET /api/provider/settings?phone=...
exports.getSettings = async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) return fail(res, "phone is required", 400, req);

    const validation = await validateProvider(phone);
    if (!validation.valid) {
      return fail(
        res,
        validation.error,
        validation.error === "unauthorized" ? 403 : 404,
        req
      );
    }

    const doc = await ProviderSettings.findOne({
      phone: validation.phone,
    }).lean();

    if (!doc) {
      // لو أول مرة
      return ok(res, {
        phone: validation.phone,
        notificationsEnabled: true,
        soundEnabled: true,
        maxDistance: 30,
        isOnline: true,
      });
    }
    return ok(res, doc);
  } catch (error) {
    console.error("getSettings error:", error);
    return fail(res, "internal error", 500, req);
  }
};

// POST /api/provider/settings
exports.updateSettings = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return fail(res, "phone is required", 400, req);

    const validation = await validateProvider(phone);
    if (!validation.valid) {
      return fail(
        res,
        validation.error,
        validation.error === "unauthorized" ? 403 : 404,
        req
      );
    }

    // 👇 هنا التعديل: نضبط المسافة داخل الرينج
    let maxDistance = req.body.maxDistance;
    if (maxDistance !== undefined && maxDistance !== null) {
      maxDistance = Number(maxDistance);
      if (Number.isNaN(maxDistance)) {
        maxDistance = 30;
      } else {
        // نخليها بين 10 و 50
        if (maxDistance < 10) maxDistance = 10;
        if (maxDistance > 50) maxDistance = 50;
      }
    } else {
      maxDistance = 30;
    }

    const doc = await ProviderSettings.findOneAndUpdate(
      { phone: validation.phone },
      {
        notificationsEnabled:
          typeof req.body.notificationsEnabled === "boolean"
            ? req.body.notificationsEnabled
            : true,
        soundEnabled:
          typeof req.body.soundEnabled === "boolean"
            ? req.body.soundEnabled
            : true,
        maxDistance,
        isOnline:
          typeof req.body.isOnline === "boolean" ? req.body.isOnline : true,
      },
      { upsert: true, new: true }
    );

    // نظف الكاش
    clearCache(`provider:stats:${validation.phone}`);

    await logActivity("provider_settings_update", req, {
      providerId: validation.user._id,
    });

    return ok(res, doc);
  } catch (error) {
    console.error("updateSettings error:", error);
    return fail(res, "internal error", 500, req);
  }
};

// POST /api/provider/status
exports.updateStatus = async (req, res) => {
  try {
    const { phone, status } = req.body;
    if (!phone) return fail(res, "phone is required", 400, req);
    if (!status) return fail(res, "status is required", 400, req);

    const validation = await validateProvider(phone);
    if (!validation.valid) {
      return fail(
        res,
        validation.error,
        validation.error === "unauthorized" ? 403 : 404,
        req
      );
    }

    const isOnline = status === "online";

    const doc = await ProviderSettings.findOneAndUpdate(
      { phone: validation.phone },
      { isOnline },
      { upsert: true, new: true }
    );

    await logActivity("provider_status_change", req, {
      status,
      providerId: validation.user._id,
    });

    console.log(`Provider ${validation.phone} status changed to: ${status}`);

    return ok(res, doc);
  } catch (error) {
    console.error("updateStatus error:", error);
    return fail(res, "internal error", 500, req);
  }
};

// POST /api/provider/location
exports.updateLocation = async (req, res) => {
  try {
    const { phone, lat, lng } = req.body;
    if (!phone) return fail(res, "phone is required", 400, req);
    if (lat == null || lng == null)
      return fail(res, "lat and lng are required", 400, req);

    const validation = await validateProvider(phone);
    if (!validation.valid) {
      return fail(
        res,
        validation.error,
        validation.error === "unauthorized" ? 403 : 404,
        req
      );
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (
      isNaN(latitude) ||
      isNaN(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return fail(res, "invalid coordinates", 400, req);
    }

    const location = {
      type: "Point",
      coordinates: [longitude, latitude],
    };

    const doc = await ProviderSettings.findOneAndUpdate(
      { phone: validation.phone },
      {
        currentLocation: location,
        lastLocationUpdate: new Date(),
      },
      { upsert: true, new: true }
    );

    return ok(res, doc);
  } catch (error) {
    console.error("updateLocation error:", error);
    return fail(res, "internal error", 500, req);
  }
};

// GET /api/provider/stats?phone=...
exports.getStats = async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) return fail(res, "phone is required", 400, req);

    const validation = await validateProvider(phone);
    if (!validation.valid) {
      return fail(
        res,
        validation.error,
        validation.error === "unauthorized" ? 403 : 404,
        req
      );
    }

    const cacheKey = `provider:stats:${validation.phone}`;
    const cached = getCache(cacheKey);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      return ok(res, cached);
    }

    const normalizedPhone = validation.phone;

    const [total, done, active, cancelled, rated] = await Promise.all([
      ServiceRequest.countDocuments({ acceptedByPhone: normalizedPhone }),
      ServiceRequest.countDocuments({
        acceptedByPhone: normalizedPhone,
        status: "done",
      }),
      ServiceRequest.countDocuments({
        acceptedByPhone: normalizedPhone,
        status: { $in: ["accepted", "on-the-way", "in-progress"] },
      }),
      ServiceRequest.countDocuments({
        acceptedByPhone: normalizedPhone,
        status: "cancelled",
      }),
      ServiceRequest.find({
        acceptedByPhone: normalizedPhone,
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
      phone: normalizedPhone,
      providerId: validation.user._id,
      total,
      done,
      active,
      cancelled,
      avgRating,
      ratingCount,
      completionRate,
      generatedAt: new Date(),
    };

    setCache(cacheKey, stats, 2 * 60 * 1000);
    res.setHeader("X-Cache", "MISS");

    return ok(res, stats);
  } catch (error) {
    console.error("getStats error:", error);
    return fail(res, "internal error", 500, req);
  }
};