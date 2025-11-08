const express = require('express');
const router = express.Router();
const { sendLoginCode, verifyCode } = require('../controllers/authController');

// Legacy endpoints - استخدم /api/whatsapp بدلاً منها
router.post('/send-code', sendLoginCode);
router.post('/verify-code', verifyCode);

module.exports = router;