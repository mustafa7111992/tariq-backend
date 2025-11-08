// controllers/whatsappController.js
const OtpCode = require('../models/OtpCode');
const { sendWhatsapp } = require('../utils/sendWhatsapp');
const User = require('../models/User');

// توحيد وتحقق من صحة الرقم
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

// POST /api/whatsapp/send-code
exports.sendLoginCode = async (req, res) => {
  try {
    const { phone, role, purpose } = req.body;

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

    // لو جاي يسوي تسجيل دخول لازم يكون موجود
    if (purpose === 'login') {
      const exists = await User.findOne({ phone: normalized });
      if (!exists) {
        return res.status(404).json({
          ok: false,
          error: 'user not found, please register first',
        });
      }
    }

    // rate limit بسيط
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

    // توليد كود
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 دقايق

    await OtpCode.findOneAndUpdate(
      { phone: normalized },
      {
        phone: normalized,
        code,
        expiresAt,
        role: role || 'customer',
        purpose: purpose || 'login',
        attempts: 0,
      },
      { upsert: true, new: true }
    );

    await sendWhatsapp({ to: normalized, code });

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
exports.verifyCode = async (req, res) => {
  try {
    const { phone } = req.body;
    // هنا أهم شي: نحول الكود لسترنغ ونشيله فراغ
    const code = req.body.code != null ? String(req.body.code).trim() : null;

    if (!phone || !code) {
      return res
        .status(400)
        .json({ ok: false, error: 'phone and code are required' });
    }

    const normalized = normalizePhone(phone);
    if (!normalized) {
      return res
        .status(400)
        .json({ ok: false, error: 'invalid phone number format' });
    }

    const record = await OtpCode.findOne({ phone: normalized });
    if (!record) {
      return res
        .status(400)
        .json({ ok: false, error: 'code not found, request new one' });
    }

    // منتهي؟
    if (record.expiresAt < new Date()) {
      await OtpCode.deleteOne({ phone: normalized });
      return res
        .status(400)
        .json({ ok: false, error: 'code expired, request new one' });
    }

    // محاولات زايدة؟
    if (record.attempts >= 3) {
      await OtpCode.deleteOne({ phone: normalized });
      return res
        .status(429)
        .json({ ok: false, error: 'too many attempts, request new code' });
    }

    // الكود غلط؟
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

    // الكود صح ✅
    const purpose = record.purpose || 'login';
    const role = record.role || 'customer';

    let user = await User.findOne({ phone: normalized });

    if (purpose === 'login') {
      if (!user) {
        await OtpCode.deleteOne({ phone: normalized });
        return res
          .status(404)
          .json({ ok: false, error: 'user not found, please register first' });
      }
    } else {
      // register
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

    // نحذف الكود بعد النجاح
    await OtpCode.deleteOne({ phone: normalized });

    console.log(`User verified successfully: ${normalized}, purpose: ${purpose}`);

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