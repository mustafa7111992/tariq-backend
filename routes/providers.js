// routes/providers.js
const express = require('express');
const router = express.Router();
const Provider = require('../models/Provider');

// ============================================================================
// GET /api/providers - جلب جميع المزودين
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const { serviceType, city, available } = req.query;

    const query = { isVerified: true, isActive: true };

    if (serviceType) query.serviceType = serviceType;
    if (city) query.city = city;
    if (available !== undefined) query.isAvailable = available === 'true';

    const providers = await Provider.find(query)
      .select('-__v')
      .sort({ rating: -1, completedJobs: -1 });

    res.status(200).json({
      success: true,
      count: providers.length,
      providers,
    });
  } catch (error) {
    console.error('❌ Get Providers Error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب المزودين',
    });
  }
});

// ============================================================================
// GET /api/providers/:phone - جلب مزود بالرقم
// ============================================================================
router.get('/:phone', async (req, res) => {
  try {
    const provider = await Provider.findOne({ phone: req.params.phone });

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'المزود غير موجود',
      });
    }

    res.status(200).json({
      success: true,
      provider,
    });
  } catch (error) {
    console.error('❌ Get Provider Error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب بيانات المزود',
    });
  }
});

// ============================================================================
// PATCH /api/providers/:phone/availability - تحديث التوفر
// ============================================================================
router.patch('/:phone/availability', async (req, res) => {
  try {
    const { available } = req.body;

    const provider = await Provider.findOne({ phone: req.params.phone });

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'المزود غير موجود',
      });
    }

    await provider.updateAvailability(available);

    res.status(200).json({
      success: true,
      message: 'تم تحديث حالة التوفر',
      provider,
    });
  } catch (error) {
    console.error('❌ Update Availability Error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في تحديث التوفر',
    });
  }
});

module.exports = router;