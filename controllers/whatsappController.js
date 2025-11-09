// controllers/whatsappController.js
const OtpCode = require('../models/OtpCode');
const Customer = require('../models/Customer'); // 👈 جديد
const Provider = require('../models/Provider'); // 👈 جديد
const { sendWhatsapp } = require('../utils/sendWhatsapp');

// ============================================================================
// توحيد وتحقق من صحة الرقم
// ============================================================================
function normalizePhone(raw) {
  if (!raw) return null;
  const p = raw.trim().replace(/\s+/g, '');

  // الأرقام العراقية التي تبدأ بـ 07
  if (p.startsWith('07')) {
    return `+964${p.slice(1)}`;
  }

  // الأرقام الدولية اللي تبدأ بـ +
  if (p.startsWith('+')) {
    if (!/^\+[0-9]+$/.test(p)) return null;
    return p;
  }

  // أي رقم ثاني: لازم يكون كله أرقام
  if (!/^[0-9]+$/.test(p)) return null;
  return p;
}

// ============================================================================
// POST /api/whatsapp/send-code - إرسال رمز التحقق
// ============================================================================
exports.sendLoginCode = async (req, res) => {
  try {
    const { phone, role, purpose, name, serviceType, city, carPlate } = req.body;

    // التحقق من الرقم
    if (!phone) {
      return res.status(400).json({ 
        ok: false, 
        error: 'phone is required' 
      });
    }

    const normalized = normalizePhone(phone);
    if (!normalized) {
      return res.status(400).json({
        ok: false,
        error: 'invalid phone number format. Please enter a valid phone number',
      });
    }

    // ============================================================================
    // التحقق من وجود المستخدم (للـ Login فقط)
    // ============================================================================
    if (purpose === 'login') {
      let exists;
      
      if (role === 'provider') {
        exists = await Provider.findOne({ phone: normalized });
        if (!exists) {
          return res.status(404).json({
            ok: false,
            error: 'provider not found, please register first',
          });
        }
      } else {
        exists = await Customer.findOne({ phone: normalized });
        if (!exists) {
          return res.status(404).json({
            ok: false,
            error: 'customer not found, please register first',
          });
        }
      }
    }

    // ============================================================================
    // التحقق من وجود مستخدم مسجل (للـ Register فقط)
    // ============================================================================
    if (purpose === 'register' || name) {
      let exists;
      
      if (role === 'provider') {
        exists = await Provider.findOne({ phone: normalized });
        if (exists) {
          return res.status(409).json({
            ok: false,
            error: 'this phone is already registered as provider',
          });
        }
      } else {
        exists = await Customer.findOne({ phone: normalized });
        if (exists) {
          return res.status(409).json({
            ok: false,
            error: 'this phone is already registered as customer',
          });
        }
      }
    }

    // ============================================================================
    // Rate Limiting
    // ============================================================================
    const existingRecord = await OtpCode.findOne({ phone: normalized });
    if (existingRecord) {
      const diff = Date.now() - existingRecord.updatedAt;
      if (diff < 60_000) {
        return res.status(429).json({
          ok: false,
          error: 'please wait before requesting new code',
          waitTime: Math.ceil((60_000 - diff) / 1000),
        });
      }
    }

    // ============================================================================
    // توليد الكود
    // ============================================================================
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 دقائق

    // تجهيز البيانات المؤقتة
    const pendingData = {};
    
    if (name) {
      pendingData.name = name;
    }
    
    if (role === 'provider') {
      pendingData.serviceType = serviceType;
      pendingData.city = city;
      pendingData.carPlate = carPlate;
    }

    // ============================================================================
    // حفظ OTP
    // ============================================================================
    await OtpCode.findOneAndUpdate(
      { phone: normalized },
      {
        phone: normalized,
        code,
        expiresAt,
        role: role || 'customer',
        purpose: purpose || (name ? 'register' : 'login'),
        attempts: 0,
        pendingData, // 👈 حفظ البيانات المؤقتة
      },
      { upsert: true, new: true }
    );

    // ============================================================================
    // إرسال الكود عبر واتساب
    // ============================================================================
    await sendWhatsapp({ to: normalized, code });

    console.log(`✅ OTP sent to ${normalized}`, {
      purpose: purpose || (name ? 'register' : 'login'),
      role: role || 'customer',
      hasPendingData: Object.keys(pendingData).length > 0,
    });

    return res.status(200).json({ 
      ok: true, 
      message: 'code sent via whatsapp' 
    });

  } catch (err) {
    console.error('❌ sendLoginCode error:', err);
    return res.status(500).json({ 
      ok: false, 
      error: 'internal error' 
    });
  }
};

// ============================================================================
// POST /api/whatsapp/verify-code - التحقق من الرمز
// ============================================================================
exports.verifyCode = async (req, res) => {
  try {
    const { phone } = req.body;
    const code = req.body.code != null ? String(req.body.code).trim() : null;

    // التحقق من المدخلات
    if (!phone || !code) {
      return res.status(400).json({ 
        ok: false, 
        error: 'phone and code are required' 
      });
    }

    const normalized = normalizePhone(phone);
    if (!normalized) {
      return res.status(400).json({ 
        ok: false, 
        error: 'invalid phone number format' 
      });
    }

    // ============================================================================
    // البحث عن OTP
    // ============================================================================
    const record = await OtpCode.findOne({ phone: normalized });
    if (!record) {
      return res.status(400).json({ 
        ok: false, 
        error: 'code not found, request new one' 
      });
    }

    // التحقق من انتهاء الصلاحية
    if (record.expiresAt < new Date()) {
      await OtpCode.deleteOne({ phone: normalized });
      return res.status(400).json({ 
        ok: false, 
        error: 'code expired, request new one' 
      });
    }

    // التحقق من المحاولات
    if (record.attempts >= 3) {
      await OtpCode.deleteOne({ phone: normalized });
      return res.status(429).json({ 
        ok: false, 
        error: 'too many attempts, request new code' 
      });
    }

    // التحقق من الكود
    if (record.code !== code) {
      await OtpCode.findOneAndUpdate(
        { phone: normalized },
        { $inc: { attempts: 1 } }
      );
      const remaining = 3 - (record.attempts + 1);
      return res.status(400).json({
        ok: false,
        error: 'invalid code',
        remainingAttempts: remaining > 0 ? remaining : 0,
      });
    }

    // ============================================================================
    // الكود صحيح ✅
    // ============================================================================
    const purpose = record.purpose || 'login';
    const role = record.role || 'customer';
    const pendingData = record.pendingData || {};

    let user;

    // ============================================================================
    // معالجة حسب النوع (Customer أو Provider)
    // ============================================================================
    if (role === 'provider') {
      // ========== Provider ==========
      user = await Provider.findOne({ phone: normalized });

      if (purpose === 'register' || (purpose === 'login' && !user)) {
        // إنشاء Provider جديد
        if (!pendingData.name || !pendingData.serviceType || !pendingData.city) {
          await OtpCode.deleteOne({ phone: normalized });
          return res.status(400).json({
            ok: false,
            error: 'missing provider data (name, serviceType, city)',
          });
        }

        user = await Provider.create({
          phone: normalized,
          name: pendingData.name,
          serviceType: pendingData.serviceType,
          city: pendingData.city,
          carPlate: pendingData.carPlate,
          isVerified: true,
        });

        console.log(`✅ New Provider registered: ${normalized}`, {
          name: user.name,
          serviceType: user.serviceType,
          city: user.city,
        });
      } else if (user) {
        // تسجيل دخول Provider موجود
        user.isVerified = true;
        await user.save();
        console.log(`✅ Provider logged in: ${normalized}`);
      }

    } else {
      // ========== Customer ==========
      user = await Customer.findOne({ phone: normalized });

      if (purpose === 'register' || (purpose === 'login' && !user)) {
        // إنشاء Customer جديد
        if (!pendingData.name) {
          await OtpCode.deleteOne({ phone: normalized });
          return res.status(400).json({
            ok: false,
            error: 'missing customer name',
          });
        }

        user = await Customer.create({
          phone: normalized,
          name: pendingData.name,
          isVerified: true,
        });

        console.log(`✅ New Customer registered: ${normalized}`, {
          name: user.name,
        });
      } else if (user) {
        // تسجيل دخول Customer موجود
        user.isVerified = true;
        await user.save();
        console.log(`✅ Customer logged in: ${normalized}`);
      }
    }

    // ============================================================================
    // التحقق النهائي
    // ============================================================================
    if (!user) {
      await OtpCode.deleteOne({ phone: normalized });
      return res.status(404).json({
        ok: false,
        error: 'user not found, please register first',
      });
    }

    // حذف OTP بعد النجاح
    await OtpCode.deleteOne({ phone: normalized });

    // ============================================================================
    // الاستجابة النهائية
    // ============================================================================
    const response = {
      ok: true,
      message: 'verified',
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        role: role,
      },
    };

    // إضافة بيانات Provider
    if (role === 'provider') {
      response.user.serviceType = user.serviceType;
      response.user.city = user.city;
      response.user.rating = user.rating;
      response.user.isAvailable = user.isAvailable;
      response.user.completedJobs = user.completedJobs;
    }

    return res.json(response);

  } catch (err) {
    console.error('❌ verifyCode error:', err);
    return res.status(500).json({ 
      ok: false, 
      error: 'internal error' 
    });
  }
};