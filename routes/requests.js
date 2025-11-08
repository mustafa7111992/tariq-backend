// routes/requests.js
const express = require('express');
const { body, query, param } = require('express-validator');
const validate = require('../middleware/validate');
const requestController = require('../controllers/requestController');

const router = express.Router();

// POST /api/requests - إنشاء طلب
router.post(
  '/',
  [
    body('serviceType').notEmpty().withMessage('serviceType is required'),
    validate,
  ],
  requestController.createRequest
);

// GET /api/requests - جلب الطلبات
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 200 }),
    query('status')
      .optional()
      .isIn(['pending', 'accepted', 'on-the-way', 'in-progress', 'done', 'cancelled']),
    query('serviceType').optional().isString(),
    validate,
  ],
  requestController.getRequests
);

// GET /api/requests/by-phone
router.get(
  '/by-phone',
  [query('phone').notEmpty().withMessage('phone is required'), validate],
  requestController.getRequestsByPhone
);

// POST /api/requests/:id/cancel (زبون)
router.post(
  '/:id/cancel',
  [param('id').isMongoId(), validate],
  requestController.cancelByCustomer
);

// GET /api/requests/for-provider (للمزوّد)
router.get(
  '/for-provider',
  [
    query('phone').notEmpty().withMessage('phone is required'), // مطلوب الآن
    query('lat').optional().isFloat({ min: -90, max: 90 }),
    query('lng').optional().isFloat({ min: -180, max: 180 }),
    query('serviceType').optional().isString(),
    query('maxKm').optional().isFloat({ min: 1, max: 100 }),
    validate,
  ],
  requestController.getForProvider
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
  [
    param('id').isMongoId(),
    body('providerPhone').notEmpty().withMessage('providerPhone is required'),
    validate,
  ],
  requestController.markOnTheWay
);

// PATCH /api/requests/:id/in-progress
router.patch(
  '/:id/in-progress',
  [
    param('id').isMongoId(),
    body('providerPhone').notEmpty().withMessage('providerPhone is required'),
    validate,
  ],
  requestController.markInProgress
);

// PATCH /api/requests/:id/complete
router.patch(
  '/:id/complete',
  [
    param('id').isMongoId(),
    body('providerPhone').notEmpty().withMessage('providerPhone is required'),
    validate,
  ],
  requestController.completeRequest
);

// PATCH /api/requests/:id/cancel-by-provider
router.patch(
  '/:id/cancel-by-provider',
  [
    param('id').isMongoId(),
    body('providerPhone').notEmpty().withMessage('providerPhone is required'),
    validate,
  ],
  requestController.cancelByProvider
);

// POST /api/requests/:id/rate-provider
router.post(
  '/:id/rate-provider',
  [
    param('id').isMongoId(),
    body('score').isInt({ min: 1, max: 5 }).withMessage('score must be between 1 and 5'),
    body('comment').optional().isString().isLength({ max: 500 }),
    body('phone').notEmpty().withMessage('phone is required'),
    validate,
  ],
  requestController.rateProvider
);

// POST /api/requests/:id/rate-customer
router.post(
  '/:id/rate-customer',
  [
    param('id').isMongoId(),
    body('score').isInt({ min: 1, max: 5 }).withMessage('score must be between 1 and 5'),
    body('comment').optional().isString().isLength({ max: 500 }),
    body('phone').notEmpty().withMessage('phone is required'),
    validate,
  ],
  requestController.rateCustomer
);

module.exports = router;