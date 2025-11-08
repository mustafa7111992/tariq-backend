// controllers/authController.js
const admin = require('firebase-admin');
const User = require('../models/User'); // استعمل موديلك الحالي لو اسمه غير غيره
const jwt = require('jsonwebtoken');

exports.firebaseLogin = async (req, res) => {
  try {
    const { phone, idToken } = req.body;

    // 1) تحقق من التوكن مع Firebase
    const decoded = await admin.auth().verifyIdToken(idToken);

    // 2) شوف رقم الفايربيس يطابق؟
    // firebase يرجع phoneNumber مثل +96477...
    if (!decoded.phone_number) {
      return res.status(400).json({ ok: false, message: 'no phone in token' });
    }

    // هنا تقدر توحد الصيغة (تشيل +964 وتحولها 07.. حسب مشروعك)
    // حالياً راح نعتمد الرقم الي جاي من التطبيق
    const normalizedPhone = phone;

    // 3) لُك أب أو أنشئ
    let user = await User.findOne({ phone: normalizedPhone });
    if (!user) {
      user = await User.create({
        phone: normalizedPhone,
        role: 'customer',
        name: '', // خليه يكمله بعدين
      });
    }

    // 4) سوّي JWT بسيط
    const token = jwt.sign(
      { id: user._id, phone: user.phone },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '7d' }
    );

    return res.json({
      ok: true,
      data: {
        id: user._id,
        phone: user.phone,
        name: user.name || '',
      },
      token,
    });
  } catch (err) {
    console.error('firebaseLogin error:', err);
    return res.status(401).json({ ok: false, message: 'invalid token' });
  }
};