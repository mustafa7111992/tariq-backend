// routes/whatsapp.js
const express = require('express');
const router = express.Router();
const OtpCode = require('../models/OtpCode');
const Customer = require('../models/Customer');
const Provider = require('../models/Provider');

// دوال مساعدة
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendWhatsAppOTP(phone, code) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioPhone = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials not configured');
  }

  const client = require('twilio')(accountSid, authToken);

  const message = await client.messages.create({
    from: twilioPhone,
    to: `whatsapp:${phone}`,
    body: `رمز التحقق الخاص بك هو: ${code}\nصالح لمدة 5 دقائق.`,
  });

  console.log('✅ WhatsApp OTP sent:', message.sid);
  return message;
}

// ============================================================================
// POST /api/whatsapp/send-code - إرسال رمز التحقق
// ============================================================================
router.post('/send-code', async (req, res) => {
  try {
    const { phone, role, name, serviceType, city, carPlate } = req.body;

    // التحقق من المدخلات
    if (!phone || !phone.startsWith('+')) {
      return res.status(400).json({
        success: false,
        message: 'رقم الهاتف غير صحيح',
      });
    }

    // التحقق من وجود المستخدم حسب النوع
    if (role === 'provider') {
      const existingProvider = await Provider.findOne({ phone });
      if (existingProvider) {
        return res.status(409).json({
          success: false,
          message: 'هذا الرقم مسجل مسبقاً كمزود خدمة',
        });
      }
    } else {
      const existingCustomer = await Customer.findOne({ phone });
      if (existingCustomer) {
        return res.status(409).json({
          success: false,
          message: 'هذا الرقم مسجل مسبقاً كعميل',
        });
      }
    }

    // توليد الكود
    const code = generateOTP();

    // تحديد الغرض
    const purpose = name ? 'register' : 'login';

    // تجهيز البيانات المؤقتة
    const pendingData = { name };

    if (role === 'provider') {
      pendingData.serviceType = serviceType;
      pendingData.city = city;
      pendingData.carPlate = carPlate;
    }

    // إنشاء OTP
    const otp = await OtpCode.createOTP({
      phone,
      code,
      role: role || 'customer',
      purpose,
      pendingData,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      expiryMinutes: 5,
    });

    console.log('✅ OTP Created:', {
      phone: otp.phone,
      code: otp.code,
      role: otp.role,
      purpose: otp.purpose,
    });

    // إرسال الكود عبر واتساب
    await sendWhatsAppOTP(phone, code);

    res.status(200).json({
      success: true,
      message: 'تم إرسال الرمز بنجاح',
      expiresIn: otp.remainingSeconds,
    });
  } catch (error) {
    console.error('❌ Send OTP Error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في إرسال الرمز',
    });
  }
});

// ============================================================================
// POST /api/whatsapp/verify-code - التحقق من الرمز
// ============================================================================
router.post('/verify-code', async (req, res) => {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({
        success: false,
        message: 'الرجاء إدخال رقم الهاتف والرمز',
      });
    }

    // البحث عن OTP صالح
    const otp = await OtpCode.findValidOTP(phone);

    if (!otp) {
      return res.status(404).json({
        success: false,
        message: 'لا توجد عملية تحقق لهذا الرقم',
      });
    }

    // التحقق من الكود
    try {
      await otp.verify(code);
    } catch (verifyError) {
      return res.status(400).json({
        success: false,
        message: verifyError.message,
      });
    }

    let user;

    // إذا كان تسجيل جديد وفيه بيانات
    if (otp.purpose === 'register' && otp.pendingData?.name) {
      if (otp.role === 'provider') {
        // ============================================================================
        // إنشاء Provider
        // ============================================================================
        user = await Provider.create({
          phone: phone,
          name: otp.pendingData.name,
          serviceType: otp.pendingData.serviceType,
          city: otp.pendingData.city,
          carPlate: otp.pendingData.carPlate,
          isVerified: true,
        });
        console.log('✅ New Provider created:', user.phone);
      } else {
        // ============================================================================
        // إنشاء Customer
        // ============================================================================
        user = await Customer.create({
          phone: phone,
          name: otp.pendingData.name,
          isVerified: true,
        });
        console.log('✅ New Customer created:', user.phone);
      }
    } else {
      // تسجيل دخول لمستخدم موجود
      if (otp.role === 'provider') {
        user = await Provider.findOne({ phone });
      } else {
        user = await Customer.findOne({ phone });
      }

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'المستخدم غير موجود. الرجاء التسجيل أولاً.',
        });
      }

      user.isVerified = true;
      await user.save();
      console.log('✅ Existing user verified:', user.phone);
    }

    // حذف OTP بعد النجاح
    await OtpCode.deleteOne({ _id: otp._id });

    res.status(200).json({
      success: true,
      message: 'تم التحقق بنجاح',
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        role: otp.role,
        // بيانات إضافية للـ Provider
        ...(otp.role === 'provider' && {
          serviceType: user.serviceType,
          city: user.city,
          rating: user.rating,
          isAvailable: user.isAvailable,
        }),
      },
    });
  } catch (error) {
    console.error('❌ Verify OTP Error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في التحقق من الرمز',
    });
  }
});

module.exports = router;