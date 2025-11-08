// controllers/whatsappController.js
const OtpCode = require('../models/OtpCode');
const { sendWhatsapp } = require('../utils/sendWhatsapp');
const User = require('../models/User');

// دالة صغيرة توحّد شكل الرقم
function normalizePhone(raw) {
  if (!raw) return null;
  const p = raw.trim();
  // لو جاي مثل 0770...
  if (p.startsWith('07')) {
    return `+964${p.slice(1)}`; // 0770 → +964770
  }
  // لو هو أصلاً يبدأ بـ +
  if (p.startsWith('+')) return p;
  // غيره نرجعه مثل ما هو
  return p;
}

// POST /api/whatsapp/send-code
exports.sendLoginCode = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ ok: false, error: 'phone is required' });
    }

    const normalized = normalizePhone(phone);

    // كود 6 أرقام
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // نخزّنه/نحدّثه
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 دقايق
    await OtpCode.findOneAndUpdate(
      { phone: normalized },
      { phone: normalized, code, expiresAt },
      { upsert: true, new: true }
    );

    // نرسله واتساب
    await sendWhatsapp({ to: normalized, code });

    return res.status(201).json({ ok: true, message: 'code sent via whatsapp' });
  } catch (err) {
    console.error('sendLoginCode error:', err);
    return res.status(500).json({ ok: false, error: 'internal error' });
  }
};

// POST /api/whatsapp/verify-code
exports.verifyCode = async (req, res) => {
  try {
    const { phone, code, role } = req.body; // role اختياري: customer / provider
    if (!phone || !code) {
      return res
        .status(400)
        .json({ ok: false, error: 'phone and code are required' });
    }

    const normalized = normalizePhone(phone);

    const record = await OtpCode.findOne({ phone: normalized });
    if (!record) {
      return res
        .status(400)
        .json({ ok: false, error: 'code not found, request new one' });
    }

    // انتهت صلاحيته؟
    if (record.expiresAt < new Date()) {
      return res
        .status(400)
        .json({ ok: false, error: 'code expired, request new one' });
    }

    // الكود غلط؟
    if (record.code !== code) {
      return res.status(400).json({ ok: false, error: 'invalid code' });
    }

    // صحيح ✅
    let user = await User.findOne({ phone: normalized });
    if (!user) {
      user = await User.create({
        phone: normalized,
        role: role || 'customer', // لو ما جاب role نخليها customer
      });
    } else if (role && user.role !== role) {
      // لو نفس الرقم دخل مرة كمستخدم ومرة كمزوّد، تقدر تحدثه هنا
      user.role = role;
      await user.save();
    }

    // نحذف الكود بعد ما استعملناه
    await OtpCode.deleteOne({ phone: normalized });

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