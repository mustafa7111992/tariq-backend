// controllers/requestController.js

const ServiceRequest = require('../models/ServiceRequest');
const ProviderSettings = require('../models/ProviderSettings');
const { ok, fail, getDistanceKm } = require('../utils/helpers');
const { logActivity } = require('../utils/activityLogger');
const { getCache, setCache, clearCache } = require('../utils/cache');

/**
 * POST /api/requests
 * إنشاء طلب خدمة
 */
exports.createRequest = async (req, res) => {
  try {
    const { serviceType, notes, location, city, customerPhone } = req.body;

    let geoLocation = null;
    if (location?.lat && location?.lng) {
      geoLocation = {
        type: 'Point',
        coordinates: [location.lng, location.lat],
      };
    }

    const doc = await ServiceRequest.create({
      serviceType,
      notes: notes || '',
      location: geoLocation,
      city: city || null,
      customerPhone: customerPhone || null,
    });

    await logActivity('request_created', req, {
      requestId: doc._id,
      serviceType,
    });

    // نظف الكاش المرتبط بالطلبات
    clearCache('requests:');

    return ok(res, doc);
  } catch (err) {
    console.error('createRequest error:', err);
    return fail(res, 'internal error', 500, req);
  }
};

/**
 * GET /api/requests
 * جلب الطلبات مع فلترة
 */
exports.getRequests = async (req, res) => {
  try {
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
  } catch (err) {
    console.error('getRequests error:', err);
    return fail(res, 'internal error', 500, req);
  }
};

/**
 * GET /api/requests/by-phone?phone=...
 * طلبات زبون معيّن
 */
exports.getRequestsByPhone = async (req, res) => {
  try {
    const { phone } = req.query;
    const reqs = await ServiceRequest.find({ customerPhone: phone })
      .sort({ createdAt: -1 })
      .lean();
    return ok(res, reqs);
  } catch (err) {
    console.error('getRequestsByPhone error:', err);
    return fail(res, 'internal error', 500, req);
  }
};

/**
 * POST /api/requests/:id/cancel
 * إلغاء من الزبون
 */
exports.cancelRequestByCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { phone } = req.body;

    const reqDoc = await ServiceRequest.findById(id);
    if (!reqDoc) return fail(res, 'request not found', 404, req);

    if (phone && reqDoc.customerPhone && phone !== reqDoc.customerPhone) {
      return fail(res, 'not your request', 403, req);
    }

    reqDoc.status = 'cancelled';
    reqDoc.cancelledAt = new Date();
    await reqDoc.save();

    await logActivity('request_cancelled', req, {
      requestId: id,
      cancelledBy: 'customer',
    });

    clearCache('requests:');

    return ok(res, reqDoc);
  } catch (err) {
    console.error('cancelRequestByCustomer error:', err);
    return fail(res, 'internal error', 500, req);
  }
};

/**
 * GET /api/requests/for-provider
 * يعيد الطلبات القريبة من المزوّد
 * لو عنده طلب شغال يرجع له بس
 */
exports.getRequestsForProvider = async (req, res) => {
  try {
    const { lat, lng, serviceType, phone } = req.query;
    let { maxKm = 30 } = req.query;

    // لو عنده طلب شغال رجّعه بس
    if (phone) {
      const activeReq = await ServiceRequest.findOne({
        acceptedByPhone: phone,
        status: { $in: ['accepted', 'on-the-way', 'in-progress'] },
      })
        .sort({ createdAt: -1 })
        .lean();

      if (activeReq) {
        const response = { ...activeReq };
        // نرجّع الموقع بشكل lat/lng للفلتر
        if (response.location?.coordinates) {
          response.location = {
            lng: response.location.coordinates[0],
            lat: response.location.coordinates[1],
          };
        }
        return ok(res, [response]);
      }
    }

    // نقرأ إعدادات المزود لو موجودة
    maxKm = parseFloat(maxKm);
    if (phone) {
      const settings = await ProviderSettings.findOne({ phone });
      if (settings?.maxDistance) {
        maxKm = settings.maxDistance;
      }
    }

    // راح نستخدم geo query
    const query = {
      status: 'pending',
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          $maxDistance: maxKm * 1000, // km -> m
        },
      },
    };

    if (serviceType) {
      query.serviceType = serviceType;
    }

    const nearby = await ServiceRequest.find(query).limit(20).lean();

    // نحسب المسافة ونرجع lat/lng بدال coordinates
    const formatted = nearby.map((r) => {
      const obj = { ...r };
      if (obj.location?.coordinates) {
        const [lo, la] = obj.location.coordinates;
        obj.location = { lat: la, lng: lo };
        obj.distance = getDistanceKm(
          parseFloat(lat),
          parseFloat(lng),
          la,
          lo
        );
      }
      return obj;
    });

    return ok(res, formatted);
  } catch (err) {
    console.error('getRequestsForProvider error:', err);
    return fail(res, 'internal error', 500, req);
  }
};

/**
 * PATCH /api/requests/:id/accept
 * قبول الطلب من المزود
 */
exports.acceptRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { providerPhone } = req.body;

    // ما يخلي المزود يشتغل على طلبين
    const activeForThisProvider = await ServiceRequest.findOne({
      acceptedByPhone: providerPhone,
      status: { $in: ['accepted', 'on-the-way', 'in-progress'] },
    });

    if (activeForThisProvider) {
      return fail(
        res,
        'you already have active request, finish it first',
        400,
        req
      );
    }

    const reqDoc = await ServiceRequest.findById(id);
    if (!reqDoc) return fail(res, 'request not found', 404, req);

    // لو الطلب مو pending ومو إله
    if (
      reqDoc.status !== 'pending' &&
      reqDoc.acceptedByPhone &&
      reqDoc.acceptedByPhone !== providerPhone
    ) {
      return fail(
        res,
        'request already accepted by another provider',
        409,
        req
      );
    }

    reqDoc.status = 'accepted';
    reqDoc.acceptedByPhone = providerPhone;
    reqDoc.acceptedAt = new Date();
    await reqDoc.save();

    await logActivity('request_accepted', req, {
      requestId: id,
      providerPhone,
    });

    clearCache('requests:');

    return ok(res, reqDoc);
  } catch (err) {
    console.error('acceptRequest error:', err);
    return fail(res, 'internal error', 500, req);
  }
};

/**
 * PATCH /api/requests/:id/on-the-way
 */
exports.setOnTheWay = async (req, res) => {
  try {
    const { id } = req.params;
    const { providerPhone } = req.body;

    const reqDoc = await ServiceRequest.findById(id);
    if (!reqDoc) return fail(res, 'request not found', 404, req);

    if (providerPhone && reqDoc.acceptedByPhone !== providerPhone) {
      return fail(res, 'not your request', 403, req);
    }

    reqDoc.status = 'on-the-way';
    await reqDoc.save();

    await logActivity('request_on_the_way', req, { requestId: id });
    clearCache('requests:');

    return ok(res, reqDoc);
  } catch (err) {
    console.error('setOnTheWay error:', err);
    return fail(res, 'internal error', 500, req);
  }
};

/**
 * PATCH /api/requests/:id/in-progress
 */
exports.setInProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const { providerPhone } = req.body;

    const reqDoc = await ServiceRequest.findById(id);
    if (!reqDoc) return fail(res, 'request not found', 404, req);

    if (providerPhone && reqDoc.acceptedByPhone !== providerPhone) {
      return fail(res, 'not your request', 403, req);
    }

    reqDoc.status = 'in-progress';
    await reqDoc.save();

    await logActivity('request_in_progress', req, { requestId: id });
    clearCache('requests:');

    return ok(res, reqDoc);
  } catch (err) {
    console.error('setInProgress error:', err);
    return fail(res, 'internal error', 500, req);
  }
};

/**
 * PATCH /api/requests/:id/complete
 * إنهاء الطلب
 */
exports.completeRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { providerPhone } = req.body;

    const reqDoc = await ServiceRequest.findById(id);
    if (!reqDoc) return fail(res, 'request not found', 404, req);

    if (providerPhone && reqDoc.acceptedByPhone !== providerPhone) {
      return fail(res, 'not your request', 403, req);
    }

    reqDoc.status = 'done';
    reqDoc.completedAt = new Date();
    await reqDoc.save();

    await logActivity('request_completed', req, { requestId: id });

    clearCache('requests:');
    if (providerPhone) {
      clearCache('provider:stats:' + providerPhone);
    }

    return ok(res, reqDoc);
  } catch (err) {
    console.error('completeRequest error:', err);
    return fail(res, 'internal error', 500, req);
  }
};

/**
 * PATCH /api/requests/:id/cancel-by-provider
 */
exports.cancelByProvider = async (req, res) => {
  try {
    const { id } = req.params;
    const { providerPhone } = req.body;

    const reqDoc = await ServiceRequest.findById(id);
    if (!reqDoc) return fail(res, 'request not found', 404, req);

    if (providerPhone && reqDoc.acceptedByPhone !== providerPhone) {
      return fail(res, 'not your request', 403, req);
    }

    reqDoc.status = 'cancelled';
    reqDoc.acceptedByPhone = null;
    reqDoc.cancelledAt = new Date();
    await reqDoc.save();

    await logActivity('request_cancelled', req, {
      requestId: id,
      cancelledBy: 'provider',
    });

    clearCache('requests:');

    return ok(res, reqDoc);
  } catch (err) {
    console.error('cancelByProvider error:', err);
    return fail(res, 'internal error', 500, req);
  }
};

/**
 * POST /api/requests/:id/rate-provider
 * المستخدم يقيّم المزود
 */
exports.rateProvider = async (req, res) => {
  try {
    const { id } = req.params;
    const { score, comment, phone } = req.body;

    const reqDoc = await ServiceRequest.findById(id);
    if (!reqDoc) return fail(res, 'request not found', 404, req);

    // تأكد هو صاحب الطلب
    if (phone && reqDoc.customerPhone && phone !== reqDoc.customerPhone) {
      return fail(res, 'not your request', 403, req);
    }

    reqDoc.providerRating = {
      score,
      comment: comment || '',
      ratedAt: new Date(),
    };
    await reqDoc.save();

    await logActivity('provider_rated', req, {
      requestId: id,
      score,
    });

    if (reqDoc.acceptedByPhone) {
      clearCache('provider:stats:' + reqDoc.acceptedByPhone);
    }

    return ok(res, reqDoc);
  } catch (err) {
    console.error('rateProvider error:', err);
    return fail(res, 'internal error', 500, req);
  }
};

/**
 * POST /api/requests/:id/rate-customer
 * المزوّد يقيّم الزبون
 */
exports.rateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { score, comment, phone } = req.body;

    const reqDoc = await ServiceRequest.findById(id);
    if (!reqDoc) return fail(res, 'request not found', 404, req);

    // تأكد هو المزود
    if (phone && reqDoc.acceptedByPhone && phone !== reqDoc.acceptedByPhone) {
      return fail(res, 'not your request', 403, req);
    }

    reqDoc.customerRating = {
      score,
      comment: comment || '',
      ratedAt: new Date(),
    };
    await reqDoc.save();

    await logActivity('customer_rated', req, {
      requestId: id,
      score,
    });

    return ok(res, reqDoc);
  } catch (err) {
    console.error('rateCustomer error:', err);
    return fail(res, 'internal error', 500, req);
  }
};