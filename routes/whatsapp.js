// routes/whatsapp.js
const express = require('express');
const router = express.Router();
const OtpCode = require('../models/OtpCode');
const User = require('../models/User');

// ============================================================================
// دوال مساعدة
// ============================================================================

// توليد OTP عشوائي
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// إرسال OTP عبر Twilio WhatsApp
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
    const { phone, role, name } = req.body;

    // التحقق من المدخلات
    if (!phone || !phone.startsWith('+')) {
      return res.status(400).json({ 
        success: false,
        message: 'رقم الهاتف غير صحيح. يجب أن يبدأ بـ +' 
      });
    }

    // التحقق من طول الرقم
    if (phone.length < 10 || phone.length > 15) {
      return res.status(400).json({ 
        success: false,
        message: 'رقم الهاتف غير صحيح' 
      });
    }

    // توليد الكود
    const code = generateOTP();

    // تحديد الغرض (تسجيل أو دخول)
    const purpose = name ? 'register' : 'login';

    // إنشاء OTP في قاعدة البيانات
    const otp = await OtpCode.createOTP({
      phone,
      code,
      role: role || 'customer',
      purpose,
      pendingData: { 
        name: name || null,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      expiryMinutes: 5,
    });

    console.log('✅ OTP Created:', {
      phone: otp.phone,
      code: otp.code,
      purpose: otp.purpose,
      expiresAt: otp.expiresAt,
      pendingData: otp.pendingData,
    });

    // إرسال الكود عبر واتساب
    try {
      await sendWhatsAppOTP(phone, code);
    } catch (twilioError) {
      console.error('❌ Twilio Error:', twilioError);
      
      // حذف OTP إذا فشل الإرسال
      await OtpCode.deleteOne({ _id: otp._id });
      
      return res.status(500).json({
        success: false,
        message: 'فشل إرسال الرمز عبر واتساب. تحقق من رقم الهاتف.',
      });
    }

    res.status(200).json({
      success: true,
      message: 'تم إرسال الرمز بنجاح',
      expiresIn: otp.remainingSeconds,
    });

  } catch (error) {
    console.error('❌ Send OTP Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'خطأ في إرسال الرمز' 
    });
  }
});

// ============================================================================
// POST /api/whatsapp/verify-code - التحقق من الرمز
// ============================================================================
router.post('/verify-code', async (req, res) => {
  try {
    const { phone, code } = req.body;

    // التحقق من المدخلات
    if (!phone || !code) {
      return res.status(400).json({ 
        success: false,
        message: 'الرجاء إدخال رقم الهاتف والرمز' 
      });
    }

    // البحث عن OTP صالح
    const otp = await OtpCode.findValidOTP(phone);

    if (!otp) {
      return res.status(404).json({ 
        success: false,
        message: 'لا توجد عملية تحقق لهذا الرقم. أرسل رمزاً جديداً.' 
      });
    }

    // التحقق من الكود
    try {
      await otp.verify(code);
    } catch (verifyError) {
      return res.status(400).json({ 
        success: false,
        message: verifyError.message 
      });
    }

    // البحث عن المستخدم
    let user = await User.findOne({ phone });

    // إذا كان تسجيل جديد وفيه بيانات مؤقتة
    if (!user && otp.purpose === 'register' && otp.pendingData?.name) {
      user = await User.create({
        phone: phone,
        name: otp.pendingData.name,
        role: otp.role,
        isVerified: true,
      });
      console.log('✅ New user created:', {
        phone: user.phone,
        name: user.name,
        role: user.role,
      });
    } 
    // إذا كان مستخدم موجود
    else if (user) {
      user.isVerified = true;
      await user.save();
      console.log('✅ Existing user verified:', user.phone);
    } 
    // إذا مافي مستخدم ومافي بيانات
    else {
      return res.status(404).json({ 
        success: false,
        message: 'المستخدم غير موجود. الرجاء التسجيل أولاً.' 
      });
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
        role: user.role,
        isVerified: user.isVerified,
      },
    });

  } catch (error) {
    console.error('❌ Verify OTP Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'خطأ في التحقق من الرمز' 
    });
  }
});

// ============================================================================
// POST /api/whatsapp/resend-code - إعادة إرسال الرمز
// ============================================================================
router.post('/resend-code', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ 
        success: false,
        message: 'رقم الهاتف مطلوب' 
      });
    }

    // حذف الأكواد القديمة
    await OtpCode.deleteMany({ 
      phone, 
      status: { $in: ['pending', 'expired'] } 
    });

    // توليد كود جديد
    const code = generateOTP();

    // إنشاء OTP جديد
    const otp = await OtpCode.create({
      phone,
      code,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    // إرسال الكود
    await sendWhatsAppOTP(phone, code);

    res.status(200).json({
      success: true,
      message: 'تم إعادة إرسال الرمز',
      expiresIn: otp.remainingSeconds,
    });

  } catch (error) {
    console.error('❌ Resend OTP Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'فشل إعادة إرسال الرمز' 
    });
  }
});

// ============================================================================
// Export Router
// ============================================================================
module.exports = router;