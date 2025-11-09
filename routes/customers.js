// routes/customers.js
const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');

// ============================================================================
// GET /api/customers - جلب جميع العملاء
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const customers = await Customer.find({ isActive: true })
      .select('-__v')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: customers.length,
      customers,
    });
  } catch (error) {
    console.error('❌ Get Customers Error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب العملاء',
    });
  }
});

// ============================================================================
// GET /api/customers/:phone - جلب عميل بالرقم
// ============================================================================
router.get('/:phone', async (req, res) => {
  try {
    const customer = await Customer.findOne({ phone: req.params.phone });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'العميل غير موجود',
      });
    }

    res.status(200).json({
      success: true,
      customer,
    });
  } catch (error) {
    console.error('❌ Get Customer Error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب بيانات العميل',
    });
  }
});

module.exports = router;