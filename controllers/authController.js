// controllers/authController.js
const admin = require('../config/firebase');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

exports.firebaseLogin = async (req, res) => {
  try {
    const { phone, idToken } = req.body;

    if (!phone || !idToken) {
      return res.status(400).json({ ok: false, message: 'phone and idToken required' });
    }

    // نحاول نتحقق من التوكن
    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch (err) {
      console.error('verifyIdToken error:', err.message);
      return res.status(401).json({ ok: false, message: 'invalid firebase token' });
    }

    // نثبّت التليفون
    const normalizedPhone = phone;

    let user = await User.findOne({ phone: normalizedPhone });
    if (!user) {
      user = await User.create({
        phone: normalizedPhone,
        role: 'customer',
      });
    }

    const token = jwt.sign(
      { id: user._id, phone: user.phone },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '7d' }
    );

    return res.json({ ok: true, data: user, token });
  } catch (err) {
    console.error('firebaseLogin error:', err);
    return res.status(500).json({ ok: false, message: 'server error' });
  }
};