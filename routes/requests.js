// routes/requests.js
const express = require('express');
const { body, query, param } = require('express-validator');
const validate = require('../middleware/validate');
const requestController = require('../controllers/requestController');

const router = express.Router();

/**
 * POST /api/requests
 * إنشاء طلب
 */
router.post(
  '/',
  [
    body('serviceType')
      .notEmpty()
      .withMessage('serviceType is required'),
    // كلشي ثاني اختياري
    validate,
  ],
  requestController.createRequest
);

/**
 * GET /api/requests
 * جلب الطلبات مع فلترة
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 200 }),
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

/**
 * GET /api/requests/by-phone?phone=...
 */
router.get(
  '/by-phone',
  [query('phone').notEmpty().withMessage('phone is required'), validate],
  requestController.getRequestsByPhone
);

/**
 * POST /api/requests/:id/cancel
 * إلغاء من الزبون
 */
router.post(
  '/:id/cancel',
  [param('id').isMongoId(), validate],
  requestController.cancelRequestByCustomer
);

/**
 * GET /api/requests/for-provider
 * الطلبات القريبة من المزود
 */
router.get(
  '/for-provider',
  [
    query('lat').notEmpty().withMessage('lat is required'),
    query('lng').notEmpty().withMessage('lng is required'),
    query('serviceType').optional(),
    query('phone').optional(),
    validate,
  ],
  // اسم الدالة بالكونترولر هو getRequestsForProvider
  requestController.getRequestsForProvider
);

/**
 * PATCH /api/requests/:id/accept
 * قبول الطلب من المزود
 */
router.patch(
  '/:id/accept',
  [
    param('id').isMongoId(),
    body('providerPhone')
      .notEmpty()
      .withMessage('providerPhone is required'),
    validate,
  ],
  requestController.acceptRequest
);

/**
 * PATCH /api/requests/:id/on-the-way
 */
router.patch(
  '/:id/on-the-way',
  [
    param('id').isMongoId(),
    // نخلي رقم المزود اختياري
    body('providerPhone').optional(),
    validate,
  ],
  requestController.setOnTheWay
);

/**
 * PATCH /api/requests/:id/in-progress
 */
router.patch(
  '/:id/in-progress',
  [
    param('id').isMongoId(),
    body('providerPhone').optional(),
    validate,
  ],
  requestController.setInProgress
);

/**
 * PATCH /api/requests/:id/complete
 */
router.patch(
  '/:id/complete',
  [
    param('id').isMongoId(),
    body('providerPhone').optional(),
    validate,
  ],
  requestController.completeRequest
);

/**
 * PATCH /api/requests/:id/cancel-by-provider
 */
router.patch(
  '/:id/cancel-by-provider',
  [
    param('id').isMongoId(),
    body('providerPhone').optional(),
    validate,
  ],
  requestController.cancelByProvider
);

/**
 * POST /api/requests/:id/rate-provider
 */
router.post(
  '/:id/rate-provider',
  [
    param('id').isMongoId(),
    body('score').isInt({ min: 1, max: 5 }),
    body('comment').optional().isString(),
    body('phone').optional().isString(),
    validate,
  ],
  requestController.rateProvider
);

/**
 * POST /api/requests/:id/rate-customer
 */
router.post(
  '/:id/rate-customer',
  [
    param('id').isMongoId(),
    body('score').isInt({ min: 1, max: 5 }),
    body('comment').optional().isString(),
    body('phone').optional().isString(),
    validate,
  ],
  requestController.rateCustomer
);

module.exports = router;