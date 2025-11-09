// routes/provider.js
const express = require('express');
const router = express.Router();
const providerController = require('../controllers/providerController');

router.get('/settings', providerController.getSettings);
router.post('/settings', providerController.updateSettings);
router.post('/status', providerController.updateStatus);
router.post('/location', providerController.updateLocation);
router.get('/stats', providerController.getStats);
router.get('/profile', providerController.getProfile); // 👈 جديد

module.exports = router;