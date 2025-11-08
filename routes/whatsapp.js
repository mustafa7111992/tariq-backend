// routes/whatsapp.js
const express = require('express');
const router = express.Router();
const {
  sendLoginCode,
  verifyCode,
} = require('../controllers/whatsappController');

// إرسال الكود
router.post('/send-code', sendLoginCode);

// التحقق من الكود
router.post('/verify-code', verifyCode);

module.exports = router;