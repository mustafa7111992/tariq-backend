// controllers/providerController.js

const ProviderSettings = require('../models/ProviderSettings');
const Provider = require('../models/Provider'); // 👈 إضافة
const ServiceRequest = require('../models/ServiceRequest');
const { ok, fail } = require('../utils/helpers');
const { logActivity } = require('../utils/activityLogger');
const { getCache, setCache, clearCache } = require('../utils/cache');

// ============================================================================
// GET /api/provider/settings?phone=...
// ============================================================================
exports.getSettings = async (req, res) => {
  const { phone } = req.query;
  
  if (!phone) {
    return fail(res, 'phone is required', 400, req);
  }

  try {
    // ✅ التحقق من وجود Provider
    const provider = await Provider.findOne({ phone }).lean();
    if (!provider) {
      return fail(res, 'provider not found', 404, req);
    }

    const doc = await ProviderSettings.findOne({ phone }).lean();
    
    if (!doc) {
      // إرجاع الإعدادات الافتراضية
      return ok(res, {
        phone,
        providerId: provider._id,
        notificationsEnabled: true,
        soundEnabled: true,
        maxDistance: 30,
        isOnline: true,
      });
    }

    return ok(res, doc);

  } catch (error) {
    console.error('❌ getSettings error:', error);
    return fail(res, 'internal error', 500, req);
  }
};

// ============================================================================
// POST /api/provider/settings
// ============================================================================
exports.updateSettings = async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return fail(res, 'phone is required', 400, req);
  }

  try {
    // ✅ التحقق من وجود Provider
    const provider = await Provider.findOne({ phone });
    if (!provider) {
      return fail(res, 'provider not found', 404, req);
    }

    const updateData = {
      phone,
      providerId: provider._id, // 👈 ربط بالـ Provider
      notificationsEnabled:
        typeof req.body.notificationsEnabled === 'boolean'
          ? req.body.notificationsEnabled
          : true,
      soundEnabled:
        typeof req.body.soundEnabled === 'boolean'
          ? req.body.soundEnabled
          : true,
      maxDistance: req.body.maxDistance ?? 30,
      isOnline:
        typeof req.body.isOnline === 'boolean' ? req.body.isOnline : true,
    };

    const doc = await ProviderSettings.findOneAndUpdate(
      { phone },
      updateData,
      { upsert: true, new: true }
    );

    // تنظيف الكاش
    clearCache(`provider:stats:${phone}`);
    clearCache(`provider:settings:${phone}`);

    await logActivity('provider_settings_update', req, {
      phone,
      updates: Object.keys(req.body),
    });

    return ok(res, doc);

  } catch (error) {
    console.error('❌ updateSettings error:', error);
    return fail(res, 'internal error', 500, req);
  }
};

// ============================================================================
// POST /api/provider/status
// ============================================================================
exports.updateStatus = async (req, res) => {
  const { phone, status } = req.body;

  if (!phone) {
    return fail(res, 'phone is required', 400, req);
  }

  if (!status || !['online', 'offline'].includes(status)) {
    return fail(res, 'status must be "online" or "offline"', 400, req);
  }

  try {
    // ✅ التحقق من وجود Provider
    const provider = await Provider.findOne({ phone });
    if (!provider) {
      return fail(res, 'provider not found', 404, req);
    }

    const isOnline = status === 'online';

    // ✅ تحديث في Provider Model أيضاً
    provider.isAvailable = isOnline;
    await provider.save();

    // تحديث في ProviderSettings
    const doc = await ProviderSettings.findOneAndUpdate(
      { phone },
      { isOnline, providerId: provider._id },
      { upsert: true, new: true }
    );

    await logActivity('provider_status_change', req, { 
      phone,
      status,
      isOnline 
    });

    clearCache(`provider:settings:${phone}`);

    return ok(res, {
      ...doc.toObject(),
      providerIsAvailable: provider.isAvailable,
    });

  } catch (error) {
    console.error('❌ updateStatus error:', error);
    return fail(res, 'internal error', 500, req);
  }
};

// ============================================================================
// POST /api/provider/location
// ============================================================================
exports.updateLocation = async (req, res) => {
  const { phone, lat, lng } = req.body;

  if (!phone) {
    return fail(res, 'phone is required', 400, req);
  }

  if (lat == null || lng == null) {
    return fail(res, 'lat and lng are required', 400, req);
  }

  // التحقق من صحة الإحداثيات
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
    return fail(res, 'invalid coordinates', 400, req);
  }

  try {
    // ✅ التحقق من وجود Provider
    const provider = await Provider.findOne({ phone });
    if (!provider) {
      return fail(res, 'provider not found', 404, req);
    }

    const location = {
      type: 'Point',
      coordinates: [longitude, latitude], // GeoJSON: [lng, lat]
    };

    // ✅ تحديث في Provider Model
    provider.location = location;
    await provider.save();

    // تحديث في ProviderSettings
    const doc = await ProviderSettings.findOneAndUpdate(
      { phone },
      {
        providerId: provider._id,
        currentLocation: location,
        lastLocationUpdate: new Date(),
      },
      { upsert: true, new: true }
    );

    console.log(`📍 Location updated for ${phone}:`, {
      lat: latitude,
      lng: longitude,
    });

    return ok(res, {
      ...doc.toObject(),
      providerLocation: provider.location,
    });

  } catch (error) {
    console.error('❌ updateLocation error:', error);
    return fail(res, 'internal error', 500, req);
  }
};

// ============================================================================
// GET /api/provider/stats?phone=...
// ============================================================================
exports.getStats = async (req, res) => {
  const { phone } = req.query;

  if (!phone) {
    return fail(res, 'phone is required', 400, req);
  }

  try {
    // ✅ التحقق من وجود Provider
    const provider = await Provider.findOne({ phone }).lean();
    if (!provider) {
      return fail(res, 'provider not found', 404, req);
    }

    const cacheKey = `provider:stats:${phone}`;
    const cached = getCache(cacheKey);
    
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return ok(res, cached);
    }

    // ✅ الإحصائيات من ServiceRequest
    const [total, done, active, cancelled, rated] = await Promise.all([
      ServiceRequest.countDocuments({ 
        acceptedBy: provider._id // 👈 بدل acceptedByPhone
      }),
      ServiceRequest.countDocuments({ 
        acceptedBy: provider._id,
        status: 'done' 
      }),
      ServiceRequest.countDocuments({
        acceptedBy: provider._id,
        status: { $in: ['accepted', 'on-the-way', 'in-progress'] },
      }),
      ServiceRequest.countDocuments({
        acceptedBy: provider._id,
        status: 'cancelled',
      }),
      ServiceRequest.find({
        acceptedBy: provider._id,
        'providerRating.score': { $exists: true },
      })
        .select('providerRating.score')
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
      providerId: provider._id,
      providerName: provider.name,
      serviceType: provider.serviceType,
      city: provider.city,
      total,
      done,
      active,
      cancelled,
      avgRating,
      ratingCount,
      completionRate,
      // من Provider Model مباشرة
      providerRating: provider.rating,
      providerCompletedJobs: provider.completedJobs,
      isAvailable: provider.isAvailable,
    };

    setCache(cacheKey, stats, 2 * 60 * 1000); // 2 دقيقة
    res.setHeader('X-Cache', 'MISS');

    return ok(res, stats);

  } catch (error) {
    console.error('❌ getStats error:', error);
    return fail(res, 'internal error', 500, req);
  }
};

// ============================================================================
// GET /api/provider/profile?phone=...
// ============================================================================
exports.getProfile = async (req, res) => {
  const { phone } = req.query;

  if (!phone) {
    return fail(res, 'phone is required', 400, req);
  }

  try {
    const provider = await Provider.findOne({ phone })
      .select('-__v')
      .lean();

    if (!provider) {
      return fail(res, 'provider not found', 404, req);
    }

    // جلب الإعدادات
    const settings = await ProviderSettings.findOne({ phone }).lean();

    return ok(res, {
      provider,
      settings: settings || {
        notificationsEnabled: true,
        soundEnabled: true,
        maxDistance: 30,
        isOnline: true,
      },
    });

  } catch (error) {
    console.error('❌ getProfile error:', error);
    return fail(res, 'internal error', 500, req);
  }
};