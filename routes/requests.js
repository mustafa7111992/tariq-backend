// routes/requests.js
const router = require('express').Router();
const { body, query, param } = require('express-validator');
const validate = require('../middleware/validate');
const requestController = require('../controllers/requestController');

// POST /api/requests
// إنشاء طلب - نخلي الفاليديشن مرن لأن الموبايل يرسل location {lat,lng}
router.post(
  '/',
  [
    body('serviceType').optional().isString(),
    body('customerPhone').optional().isString(),
    body('location')
      .optional()
      .custom((val) => {
        // نقبل null أو object فيه lat/lng أرقام
        if (val == null) return true;
        if (typeof val !== 'object') throw new Error('location must be an object');
        if (val.lat == null || val.lng == null) {
          // السيرفر راح يحاول يحوله GeoJSON إذا موجود
          return true;
        }
        if (typeof val.lat !== 'number' || typeof val.lng !== 'number') {
          throw new Error('location.lat and location.lng must be numbers');
        }
        return true;
      }),
    validate,
  ],
  requestController.createRequest
);

// GET /api/requests
// لستة الطلبات مع فلترة
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('status')
      .optional()
      .isIn([
        'pending',
        'accepted',
        'on-the-way',
        'in-progress',
        'done',
        'cancelled',
      ]),
    query('serviceType').optional().isString(),
    validate,
  ],
  requestController.getRequests
);

// GET /api/requests/by-phone?phone=...
router.get(
  '/by-phone',
  [query('phone').notEmpty().withMessage('phone is required'), validate],
  requestController.getRequestsByPhone
);

// POST /api/requests/:id/cancel
router.post(
  '/:id/cancel',
  [param('id').isMongoId(), validate],
  requestController.cancelRequestByCustomer
);

// GET /api/requests/for-provider
// نراعي الاسم القديم getForProvider لو كان موجود
router.get(
  '/for-provider',
  [
    query('lat').notEmpty().withMessage('lat is required'),
    query('lng').notEmpty().withMessage('lng is required'),
    query('phone').optional().isString(),
    query('serviceType').optional().isString(),
    validate,
  ],
  (req, res, next) => {
    const handler =
      requestController.getRequestsForProvider ||
      requestController.getForProvider;
    return handler(req, res, next);
  }
);

// PATCH /api/requests/:id/accept
router.patch(
  '/:id/accept',
  [
    param('id').isMongoId(),
    body('providerPhone').notEmpty().withMessage('providerPhone is required'),
    validate,
  ],
  requestController.acceptRequest
);

// PATCH /api/requests/:id/on-the-way
router.patch(
  '/:id/on-the-way',
  [param('id').isMongoId(), validate],
  requestController.setOnTheWay
);

// PATCH /api/requests/:id/in-progress
router.patch(
  '/:id/in-progress',
  [param('id').isMongoId(), validate],
  requestController.setInProgress
);

// PATCH /api/requests/:id/complete
router.patch(
  '/:id/complete',
  [param('id').isMongoId(), validate],
  requestController.completeRequest
);

// PATCH /api/requests/:id/cancel-by-provider
router.patch(
  '/:id/cancel-by-provider',
  [param('id').isMongoId(), validate],
  requestController.cancelByProvider
);

// POST /api/requests/:id/rate-provider
router.post(
  '/:id/rate-provider',
  [
    param('id').isMongoId(),
    body('score').isInt({ min: 1, max: 5 }),
    body('comment').optional().isString(),
    validate,
  ],
  requestController.rateProvider
);

// POST /api/requests/:id/rate-customer
router.post(
  '/:id/rate-customer',
  [
    param('id').isMongoId(),
    body('score').isInt({ min: 1, max: 5 }),
    body('comment').optional().isString(),
    validate,
  ],
  requestController.rateCustomer
);

module.exports = router;