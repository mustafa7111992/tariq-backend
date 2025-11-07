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
    body('customerPhone')
      .optional()
      .isString()
      .withMessage('customerPhone must be string'),
    // location: { lat: Number, lng: Number }
    body('location')
      .optional()
      .custom((val) => {
        if (val == null) return true;
        if (typeof val !== 'object') {
          throw new Error('location must be object');
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

/**
 * GET /api/requests
 * لستة الطلبات (للأدمن أو للتطبيق)
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('page must be int'),
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
      ])
      .withMessage('invalid status'),
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
 * GET /api/requests/for-provider
 * لازم يجي lat & lng
 * نخليها قبل الراوتات اللي بيها :id
 */
router.get(
  '/for-provider',
  [
    query('lat').notEmpty().withMessage('lat is required'),
    query('lng').notEmpty().withMessage('lng is required'),
    query('phone').optional(),
    query('serviceType').optional(),
    validate,
  ],
  requestController.getRequestsForProvider
);

/**
 * POST /api/requests/:id/cancel
 * إلغاء من الزبون
 */
router.post(
  '/:id/cancel',
  [param('id').isMongoId().withMessage('invalid id'), validate],
  requestController.cancelRequestByCustomer
);

/**
 * PATCH /api/requests/:id/accept
 */
router.patch(
  '/:id/accept',
  [
    param('id').isMongoId().withMessage('invalid id'),
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
  [param('id').isMongoId().withMessage('invalid id'), validate],
  requestController.setOnTheWay
);

/**
 * PATCH /api/requests/:id/in-progress
 */
router.patch(
  '/:id/in-progress',
  [param('id').isMongoId().withMessage('invalid id'), validate],
  requestController.setInProgress
);

/**
 * PATCH /api/requests/:id/complete
 */
router.patch(
  '/:id/complete',
  [param('id').isMongoId().withMessage('invalid id'), validate],
  requestController.completeRequest
);

/**
 * PATCH /api/requests/:id/cancel-by-provider
 */
router.patch(
  '/:id/cancel-by-provider',
  [param('id').isMongoId().withMessage('invalid id'), validate],
  requestController.cancelByProvider
);

/**
 * POST /api/requests/:id/rate-provider
 */
router.post(
  '/:id/rate-provider',
  [
    param('id').isMongoId().withMessage('invalid id'),
    body('score').isInt({ min: 1, max: 5 }).withMessage('score 1-5'),
    validate,
  ],
  requestController.rateProvider
);

/**
 * POST /api/requests/:id/rate-customer
 */
router.post(
  '/:id/rate-customer',
  [param('id').isMongoId().withMessage('invalid id'), validate],
  requestController.rateCustomer
);

module.exports = router;