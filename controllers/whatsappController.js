// controllers/whatsappController.js
const OtpCode = require('../models/OtpCode');
const { sendWhatsapp } = require('../utils/sendWhatsapp');
const User = require('../models/User');

// توحيد وتحقق من صحة الرقم
function normalizePhone(raw) {
  if (!raw) return null;
  const p = raw.trim().replace(/\s+/g, ''); // إزالة المسافات

  // الأرقام العراقية التي تبدأ بـ 07
  if (p.startsWith('07')) {
    const phone = `+964${p.slice(1)}`;
    return phone;
  }

  // الأرقام التي تبدأ بـ +
  if (p.startsWith('+')) {
    // التحقق من أن الرقم يحتوي على أرقام فقط بعد +
    if (!/^\+[0-9]+$/.test(p)) {
      return null;
    }
    return p;
  }

  // أي رقم آخر نرجعه كما هو بعد التحقق من أنه أرقام فقط
  if (!/^[0-9]+$/.test(p)) {
    return null;
  }

  return p;
}

// نحول الأرقام العربية/الفارسية إلى إنكليزي حتى ما يرفضها
function normalizeCode(raw = '') {
  const map = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
    '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  };
  return raw
    .toString()
    .trim()
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('');
}

// POST /api/whatsapp/send-code
// body: { phone, role?, purpose? = 'login' | 'register' }
exports.sendLoginCode = async (req, res) => {
  try {
    const { phone, role, purpose } = req.body;

    // التحقق من المدخلات
    if (!phone) {
      return res.status(400).json({ ok: false, error: 'phone is required' });
    }

    const normalized = normalizePhone(phone);
    if (!normalized) {
      return res.status(400).json({
        ok: false,
        error: 'invalid phone number format. Please enter a valid phone number',
      });
    }

    // Rate limiting - منع الطلبات المتكررة
    const existingRecord = await OtpCode.findOne({ phone: normalized });
    if (existingRecord) {
      const timeSinceLastRequest = new Date() - existingRecord.updatedAt;
      if (timeSinceLastRequest < 60000) {
        // دقيقة واحدة
        const waitTime = Math.ceil((60000 - timeSinceLastRequest) / 1000);
        return res.status(429).json({
          ok: false,
          error: 'please wait before requesting new code',
          waitTime: waitTime,
        });
      }
    }

    // التحقق من وجود المستخدم في حالة login
    if (purpose === 'login') {
      const exists = await User.findOne({ phone: normalized });
      if (!exists) {
        return res.status(404).json({
          ok: false,
          error: 'user not found, please register first',
        });
      }
    }

    // توليد كود 6 أرقام
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 دقائق

    await OtpCode.findOneAndUpdate(
      { phone: normalized },
      {
        phone: normalized,
        code,
        expiresAt,
        role: role || 'customer',
        purpose: purpose || 'login',
        attempts: 0, // عداد المحاولات
      },
      { upsert: true, new: true }
    );

    // إرسال الواتساب
    await sendWhatsapp({ to: normalized, code });

    // Logging
    console.log(
      `OTP sent to ${normalized}, purpose: ${purpose || 'login'}, role: ${
        role || 'customer'
      }`
    );

    return res.status(200).json({ ok: true, message: 'code sent via whatsapp' });
  } catch (err) {
    console.error('sendLoginCode error:', err);
    return res.status(500).json({ ok: false, error: 'internal error' });
  }
};

// POST /api/whatsapp/verify-code
// body: { phone, code }
exports.verifyCode = async (req, res) => {
  try {
    const { phone, code } = req.body;

    // التحقق من المدخلات
    if (!phone || !code) {
      return res
        .status(400)
        .json({ ok: false, error: 'phone and code are required' });
    }

    const normalized = normalizePhone(phone);
    if (!normalized) {
      return res.status(400).json({
        ok: false,
        error: 'invalid phone number format',
      });
    }

    const record = await OtpCode.findOne({ phone: normalized });

    if (!record) {
      return res
        .status(400)
        .json({ ok: false, error: 'code not found, request new one' });
    }

    // التحقق من انتهاء الصلاحية
    if (record.expiresAt < new Date()) {
      await OtpCode.deleteOne({ phone: normalized }); // حذف الكود المنتهي
      return res
        .status(400)
        .json({ ok: false, error: 'code expired, request new one' });
    }

    // التحقق من عدد المحاولات (حماية من brute force)
    if (record.attempts >= 3) {
      await OtpCode.deleteOne({ phone: normalized });
      return res.status(429).json({
        ok: false,
        error: 'too many attempts, request new code',
      });
    }

    // نحول الكود اللي جانا حتى لو هو عربي
    const userCode = normalizeCode(code);

    // التحقق من صحة الكود
    if (record.code !== userCode) {
      // زيادة عداد المحاولات
      await OtpCode.findOneAndUpdate(
        { phone: normalized },
        { $inc: { attempts: 1 } }
      );

      const remainingAttempts = 3 - (record.attempts + 1);
      return res.status(400).json({
        ok: false,
        error: 'invalid code',
        remainingAttempts: remainingAttempts > 0 ? remainingAttempts : 0,
      });
    }

    // الكود صحيح ✅
    const purpose = record.purpose || 'login';
    const role = record.role || 'customer';

    let user = await User.findOne({ phone: normalized });

    if (purpose === 'login') {
      // login فقط → لازم يكون موجود
      if (!user) {
        await OtpCode.deleteOne({ phone: normalized });
        return res.status(404).json({
          ok: false,
          error: 'user not found, please register first',
        });
      }
    } else {
      // register → إذا مو موجود نسويه
      if (!user) {
        user = await User.create({
          phone: normalized,
          role,
        });
        console.log(`New user registered: ${normalized}, role: ${role}`);
      } else if (role && user.role !== role) {
        user.role = role;
        await user.save();
        console.log(`User role updated: ${normalized}, new role: ${role}`);
      }
    }

    // حذف الكود بعد الاستخدام الناجح
    await OtpCode.deleteOne({ phone: normalized });

    // Logging
    console.log(
      `User verified successfully: ${normalized}, purpose: ${purpose}`
    );

    return res.json({
      ok: true,
      message: 'verified',
      user: {
        id: user._id,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('verifyCode error:', err);
    return res.status(500).json({ ok: false, error: 'internal error' });
  }
};