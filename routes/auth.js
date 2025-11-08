const express = require('express');
const router = express.Router();
const { sendLoginCode } = require('../controllers/authController');

router.post('/send-code', sendLoginCode);

module.exports = router;