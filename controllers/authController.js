const { sendWhatsapp } = require('../utils/sendWhatsapp');

exports.sendLoginCode = async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone is required' });

  // توليد كود 6 أرقام
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  // تبعثه عبر واتساب
  try {
    await sendWhatsapp({ to: phone, code });
    res.json({ ok: true, message: 'تم إرسال كود التحقق عبر واتساب' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};