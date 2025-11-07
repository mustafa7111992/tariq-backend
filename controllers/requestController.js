// controllers/requestController.js
const ServiceRequest = require('../models/ServiceRequest');
const ProviderSettings = require('../models/ProviderSettings');
const { ok, fail } = require('../utils/response');
const { getDistanceKm } = require('../utils/distance');

// إنشاء طلب جديد
exports.createRequest = async (req, res) => {
  try {
    const body = req.body;

    if (!body.customerPhone || !body.serviceType || !body.location) {
      return fail(res, 'missing required fields');
    }

    const reqDoc = new ServiceRequest({
      customerPhone: body.customerPhone,
      serviceType: body.serviceType,
      notes: body.notes || '',
      status: 'pending',
      location: {
        type: 'Point',
        coordinates: [body.location.lng, body.location.lat],
      },
    });

    await reqDoc.save();
    return ok(res, reqDoc);
  } catch (err) {
    console.error('createRequest error:', err);
    return fail(res, 'internal error', 500, req);
  }
};

// جلب كل الطلبات
exports.getAllRequests = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    const total = await ServiceRequest.countDocuments();
    const data = await ServiceRequest.find()
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .lean();

    return ok(res, data, { total });
  } catch (err) {
    console.error('getAllRequests error:', err);
    return fail(res, 'internal error', 500, req);
  }
};

// جلب الطلبات الخاصة بالمزوّد (قريبة منه)
exports.getRequestsForProvider = async (req, res) => {
  try {
    const { lat, lng, serviceType, phone } = req.query;
    let { maxKm = 30 } = req.query;

    // لو المزوّد عنده طلب نشط نرجّعه
    if (phone) {
      const activeReq = await ServiceRequest.findOne({
        acceptedByPhone: phone,
        status: { $in: ['accepted', 'on-the-way', 'in-progress'] },
      })
        .sort({ createdAt: -1 })
        .lean();

      if (activeReq) {
        const response = { ...activeReq };
        if (response.location?.coordinates) {
          response.location = {
            lng: response.location.coordinates[0],
            lat: response.location.coordinates[1],
          };
        }
        return ok(res, [response]);
      }
    }

    // إعدادات المزوّد (أقصى مسافة)
    maxKm = parseFloat(maxKm);
    if (phone) {
      const settings = await ProviderSettings.findOne({ phone });
      if (settings?.maxDistance) {
        maxKm = settings.maxDistance;
      }
    }

    // الفلتر الأساسي
    const baseFilter = {
      status: 'pending',
    };
    if (serviceType) {
      baseFilter.serviceType = serviceType;
    }

    let nearby = [];

    // نحاول geo query
    if (lat && lng) {
      const geoQuery = {
        ...baseFilter,
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [parseFloat(lng), parseFloat(lat)],
            },
            $maxDistance: maxKm * 1000,
          },
        },
      };

      try {
        nearby = await ServiceRequest.find(geoQuery).limit(20).lean();
      } catch (err) {
        // Fallback لو ماكو index
        console.error(
          'geo query failed, falling back to simple query:',
          err.message
        );
        nearby = await ServiceRequest.find(baseFilter)
          .sort({ createdAt: -1 })
          .limit(20)
          .lean();
      }
    } else {
      nearby = await ServiceRequest.find(baseFilter)
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();
    }

    // تحويل location + احتساب distance
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
    console.error('getRequestsForProvider error:', err);
    return fail(res, 'internal error', 500, req);
  }
};

// قبول الطلب
exports.acceptRequest = async (req, res) => {
  try {
    const id = req.params.id;
    const { providerPhone } = req.body;
    const reqDoc = await ServiceRequest.findById(id);
    if (!reqDoc) return fail(res, 'not found', 404);

    if (reqDoc.status !== 'pending') {
      return fail(res, 'already accepted');
    }

    reqDoc.status = 'accepted';
    reqDoc.acceptedByPhone = providerPhone;
    await reqDoc.save();

    return ok(res, reqDoc);
  } catch (err) {
    console.error('acceptRequest error:', err);
    return fail(res, 'internal error', 500, req);
  }
};

// تحديث الحالة إلى "في الطريق"
exports.markOnTheWay = async (req, res) => {
  try {
    const id = req.params.id;
    const reqDoc = await ServiceRequest.findById(id);
    if (!reqDoc) return fail(res, 'not found', 404);

    reqDoc.status = 'on-the-way';
    await reqDoc.save();

    return ok(res, reqDoc);
  } catch (err) {
    console.error('markOnTheWay error:', err);
    return fail(res, 'internal error', 500, req);
  }
};

// تحديث الحالة إلى "قيد التنفيذ"
exports.markInProgress = async (req, res) => {
  try {
    const id = req.params.id;
    const reqDoc = await ServiceRequest.findById(id);
    if (!reqDoc) return fail(res, 'not found', 404);

    reqDoc.status = 'in-progress';
    await reqDoc.save();

    return ok(res, reqDoc);
  } catch (err) {
    console.error('markInProgress error:', err);
    return fail(res, 'internal error', 500, req);
  }
};

// إنهاء الطلب
exports.markComplete = async (req, res) => {
  try {
    const id = req.params.id;
    const reqDoc = await ServiceRequest.findById(id);
    if (!reqDoc) return fail(res, 'not found', 404);

    reqDoc.status = 'done';
    await reqDoc.save();

    return ok(res, reqDoc);
  } catch (err) {
    console.error('markComplete error:', err);
    return fail(res, 'internal error', 500, req);
  }
};

// إلغاء الطلب من المزوّد
exports.cancelByProvider = async (req, res) => {
  try {
    const id = req.params.id;
    const { providerPhone } = req.body;
    const reqDoc = await ServiceRequest.findById(id);
    if (!reqDoc) return fail(res, 'not found', 404);

    reqDoc.status = 'cancelled';
    reqDoc.cancelledBy = providerPhone;
    await reqDoc.save();

    return ok(res, reqDoc);
  } catch (err) {
    console.error('cancelByProvider error:', err);
    return fail(res, 'internal error', 500, req);
  }
};