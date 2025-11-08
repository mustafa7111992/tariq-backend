// controllers/whatsappController.js
const OtpCode = require('../models/OtpCode');
const { sendWhatsapp } = require('../utils/sendWhatsapp');
const User = require('../models/User'); // لو عندك موديل اسمه كذا

// POST /api/whatsapp/send-code
exports.sendLoginCode = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ ok: false, error: 'phone is required' });

    // سوّي كود 6 أرقام
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // خزن الكود
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // بعد 5 دقايق
    await OtpCode.findOneAndUpdate(
      { phone },
      { phone, code, expiresAt },
      { upsert: true, new: true }
    );

    // أرسله واتساب
    await sendWhatsapp({ to: phone, code });

    return res.json({ ok: true, message: 'code sent via whatsapp' });
  } catch (err) {
    console.error('sendLoginCode error:', err);
    return res.status(500).json({ ok: false, error: 'internal error' });
  }
};

// POST /api/whatsapp/verify-code
exports.verifyCode = async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ ok: false, error: 'phone and code are required' });
    }

    const record = await OtpCode.findOne({ phone });
    if (!record) {
      return res.status(400).json({ ok: false, error: 'code not found, request new one' });
    }

    // انتهى؟
    if (record.expiresAt < new Date()) {
      return res.status(400).json({ ok: false, error: 'code expired, request new one' });
    }

    // غلط؟
    if (record.code !== code) {
      return res.status(400).json({ ok: false, error: 'invalid code' });
    }

    // وصلنا هنا يعني صح ✅
    // تقدر هنا:
    // 1) ترجع OK
    // 2) أو تنشئ المستخدم لو مو موجود
    let user = await User.findOne({ phone });
    if (!user) {
      user = await User.create({
        phone,
        role: 'customer', // غيرها لو مزود
      });
    }

    // ممكن تمسح الكود بعد التحقق
    await OtpCode.deleteOne({ phone });

    return res.json({
      ok: true,
      message: 'verified',
      user: {
        id: user._id,
        phone: user.phone,
        role: user.role,
      },
      // تقدر ترجع توكن JWT هنا لو تريد
    });
  } catch (err) {
    console.error('verifyCode error:', err);
    return res.status(500).json({ ok: false, error: 'internal error' });
  }
};