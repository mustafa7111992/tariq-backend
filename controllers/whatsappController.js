// controllers/whatsappController.js
const OtpCode = require('../models/OtpCode');
const { sendWhatsapp } = require('../utils/sendWhatsapp');
const Customer = require('../models/Customer');
const Provider = require('../models/Provider');

// نفس التوحيد
function normalizePhone(raw) {
  if (!raw) return null;
  const p = raw.trim().replace(/\s+/g, '');
  if (p.startsWith('07')) return `+964${p.slice(1)}`;
  if (p.startsWith('+')) return /^\+[0-9]+$/.test(p) ? p : null;
  return /^[0-9]+$/.test(p) ? p : null;
}

// POST /api/whatsapp/send-code
exports.sendLoginCode = async (req, res) => {
  try {
    const { phone, role = 'customer', purpose = 'login' } = req.body;

    const normalized = normalizePhone(phone);
    if (!normalized) {
      return res.status(400).json({ success: false, message: 'رقم غير صالح' });
    }

    // 👇 أهم جزء: إذا طلب login لازم الرقم يكون موجود بالكللكشن الصح
    if (purpose === 'login') {
      if (role === 'customer') {
        const exists = await Customer.findOne({ phone: normalized });
        if (!exists) {
          return res
            .status(404)
            .json({ success: false, message: 'المستخدم غير موجود. الرجاء التسجيل أولاً.' });
        }
      } else if (role === 'provider') {
        const exists = await Provider.findOne({ phone: normalized });
        if (!exists) {
          return res
            .status(404)
            .json({ success: false, message: 'المزوّد غير موجود. الرجاء التسجيل أولاً.' });
        }
      }
    }

    // توليد كود
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await OtpCode.findOneAndUpdate(
      { phone: normalized },
      {
        phone: normalized,
        code,
        expiresAt,
        role,
        purpose,
        attempts: 0,
      },
      { upsert: true, new: true }
    );

    await sendWhatsapp({ to: normalized, code });

    return res.json({
      success: true,
      message: 'تم إرسال الرمز بنجاح',
      expiresIn: 300,
    });
  } catch (err) {
    console.error('sendLoginCode error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في إرسال الرمز' });
  }
};

// POST /api/whatsapp/verify-code
exports.verifyCode = async (req, res) => {
  try {
    const { phone, code } = req.body;
    const normalized = normalizePhone(phone);
    if (!normalized || !code) {
      return res.status(400).json({ success: false, message: 'phone and code are required' });
    }

    const record = await OtpCode.findOne({ phone: normalized });
    if (!record) {
      return res.status(404).json({ success: false, message: 'الرمز غير موجود. اطلب رمز جديد.' });
    }

    if (record.expiresAt < new Date()) {
      await OtpCode.deleteOne({ phone: normalized });
      return res.status(400).json({ success: false, message: 'الكود منتهي الصلاحية' });
    }

    if (record.code !== code.trim()) {
      return res.status(400).json({ success: false, message: 'الكود غير صحيح' });
    }

    // لو وصلنا هنا الكود صحيح
    await OtpCode.deleteOne({ phone: normalized });

    return res.json({
      success: true,
      message: 'تم التحقق بنجاح',
      role: record.role,
      purpose: record.purpose,
      phone: normalized,
    });
  } catch (err) {
    console.error('verifyCode error:', err);
    return res.status(500).json({ success: false, message: 'internal error' });
  }
};