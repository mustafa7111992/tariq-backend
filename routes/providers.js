// routes/providers.js
const router = require('express').Router();
const { body, query } = require('express-validator');
const validate = require('../middleware/validate');
const providerController = require('../controllers/providerController');

// تسجيل / تحديث مزوّد
router.post(
  '/register',
  [
    body('phone').notEmpty().withMessage('phone is required'),
    body('name').notEmpty().withMessage('name is required'),
    body('serviceType').optional().isString(),
    body('city').optional().isString(),
    validate(), // يستعمل ميدلويرك الحالي
  ],
  providerController.registerProvider
);

// فحص وجود المزوّد (تستخدمها شاشة تسجيل الدخول)
router.get(
  '/check',
  [query('phone').notEmpty().withMessage('phone is required'), validate()],
  providerController.checkProvider
);

// اختياري: قائمة مزودين
router.get('/', providerController.listProviders);

module.exports = router;