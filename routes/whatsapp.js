// routes/whatsapp.js
const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const router = express.Router();
const {
  sendLoginCode,
  verifyCode,
} = require('../controllers/whatsappController');

// إرسال الكود
router.post(
  '/send-code',
  [
    body('phone').notEmpty().withMessage('phone is required'),
    body('role').optional().isIn(['customer', 'provider']).withMessage('role must be customer or provider'),
    body('purpose').optional().isIn(['login', 'register']).withMessage('purpose must be login or register'),
    validate,
  ],
  sendLoginCode
);

// التحقق من الكود
router.post(
  '/verify-code',
  [
    body('phone').notEmpty().withMessage('phone is required'),
    body('code')
      .notEmpty()
      .withMessage('code is required')
      .isLength({ min: 6, max: 6 })
      .withMessage('code must be 6 digits')
      .isNumeric()
      .withMessage('code must be numeric'),
    validate,
  ],
  verifyCode
);

module.exports = router;