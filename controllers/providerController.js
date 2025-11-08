// controllers/providerController.js

const ProviderSettings = require("../models/ProviderSettings");
const ServiceRequest = require("../models/ServiceRequest");
const User = require("../models/User");
const { ok, fail } = require("../utils/helpers");
const { logActivity } = require("../utils/activityLogger");
const { getCache, setCache, clearCache } = require("../utils/cache");

// Helper function للتحقق من صحة Provider
async function validateProvider(phone, userId = null) {
  const user = await User.findOne({ phone, role: 'provider' });
  if (!user) {
    return { valid: false, error: 'provider not found' };
  }
  if (userId && user._id.toString() !== userId) {
    return { valid: false, error: 'unauthorized' };
  }
  return { valid: true, user };
}

// GET /api/provider/settings?phone=... (أو من userId في header/token)
exports.getSettings = async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) return fail(res, "phone is required", 400, req);

    // التحقق من أن المستخدم provider صحيح
    const validation = await validateProvider(phone);
    if (!validation.valid) {
      return fail(res, validation.error, validation.error === 'unauthorized' ? 403 : 404, req);
    }

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
  } catch (error) {
    console.error('getSettings error:', error);
    return fail(res, "internal error", 500, req);
  }
};

// POST /api/provider/settings
exports.updateSettings = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return fail(res, "phone is required", 400, req);

    // التحقق من أن المستخدم provider صحيح
    const validation = await validateProvider(phone);
    if (!validation.valid) {
      return fail(res, validation.error, validation.error === 'unauthorized' ? 403 : 404, req);
    }

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

    // تنظيف كاش الإحصائيات
    clearCache(`provider:stats:${phone}`);

    await logActivity("provider_settings_update", req, { providerId: validation.user._id });

    return ok(res, doc);
  } catch (error) {
    console.error('updateSettings error:', error);
    return fail(res, "internal error", 500, req);
  }
};

// POST /api/provider/status
exports.updateStatus = async (req, res) => {
  try {
    const { phone, status } = req.body;
    if (!phone) return fail(res, "phone is required", 400, req);
    if (!status) return fail(res, "status is required", 400, req);

    // التحقق من أن المستخدم provider صحيح
    const validation = await validateProvider(phone);
    if (!validation.valid) {
      return fail(res, validation.error, validation.error === 'unauthorized' ? 403 : 404, req);
    }

    const isOnline = status === "online";

    const doc = await ProviderSettings.findOneAndUpdate(
      { phone },
      { isOnline },
      { upsert: true, new: true }
    );

    await logActivity("provider_status_change", req, { 
      status, 
      providerId: validation.user._id 
    });

    console.log(`Provider ${phone} status changed to: ${status}`);

    return ok(res, doc);
  } catch (error) {
    console.error('updateStatus error:', error);
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

    // التحقق من أن المستخدم provider صحيح
    const validation = await validateProvider(phone);
    if (!validation.valid) {
      return fail(res, validation.error, validation.error === 'unauthorized' ? 403 : 404, req);
    }

    // التحقق من صحة الإحداثيات
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    
    if (isNaN(latitude) || isNaN(longitude) || 
        latitude < -90 || latitude > 90 || 
        longitude < -180 || longitude > 180) {
      return fail(res, "invalid coordinates", 400, req);
    }

    const location = {
      type: "Point",
      coordinates: [longitude, latitude],
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
  } catch (error) {
    console.error('updateLocation error:', error);
    return fail(res, "internal error", 500, req);
  }
};

// GET /api/provider/stats?phone=...
exports.getStats = async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) return fail(res, "phone is required", 400, req);

    // التحقق من أن المستخدم provider صحيح
    const validation = await validateProvider(phone);
    if (!validation.valid) {
      return fail(res, validation.error, validation.error === 'unauthorized' ? 403 : 404, req);
    }

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

    setCache(cacheKey, stats, 2 * 60 * 1000); // cache لمدة دقيقتين
    res.setHeader("X-Cache", "MISS");

    return ok(res, stats);
  } catch (error) {
    console.error('getStats error:', error);
    return fail(res, "internal error", 500, req);
  }
};