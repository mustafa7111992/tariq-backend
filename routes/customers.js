// routes/customers.js
const router = require('express').Router();
const Customer = require('../models/Customer');

// نطبّق نفس التوحيد
function normalizePhone(raw) {
  if (!raw) return null;
  const p = raw.trim().replace(/\s+/g, '');
  if (p.startsWith('07')) return `+964${p.slice(1)}`;
  if (p.startsWith('+')) return /^\+[0-9]+$/.test(p) ? p : null;
  return /^[0-9]+$/.test(p) ? p : null;
}

// POST /api/customers/register
router.post('/register', async (req, res) => {
  try {
    const { phone, name, email, avatar } = req.body;
    const normalized = normalizePhone(phone);

    if (!normalized) {
      return res.status(400).json({ ok: false, error: 'invalid phone' });
    }
    if (!name) {
      return res.status(400).json({ ok: false, error: 'name is required' });
    }

    // شوف إذا موجود
    let customer = await Customer.findOne({ phone: normalized });

    if (customer) {
      // لا ترمي خطأ، حدّثه وارجعه
      customer.name = name;
      if (email) customer.email = email;
      if (avatar) customer.avatar = avatar;
      await customer.save();

      return res.json({ ok: true, customer, existed: true });
    }

    // مو موجود → سوّ واحد جديد
    customer = await Customer.create({
      phone: normalized,
      name,
      email: email || undefined,
      avatar: avatar || undefined,
      isVerified: false,
    });

    return res.status(201).json({ ok: true, customer, existed: false });
  } catch (err) {
    console.error('customer register error:', err);
    return res.status(500).json({ ok: false, error: 'internal error' });
  }
});

// GET /api/customers/check?phone=...
router.get('/check', async (req, res) => {
  try {
    const normalized = normalizePhone(req.query.phone);
    if (!normalized) {
      return res.status(400).json({ ok: false, error: 'invalid phone' });
    }

    const customer = await Customer.findOne({ phone: normalized }).lean();
    if (!customer) {
      return res.status(404).json({ ok: false, error: 'customer not found' });
    }
    return res.json({ ok: true, customer });
  } catch (err) {
    console.error('customer check error:', err);
    return res.status(500).json({ ok: false, error: 'internal error' });
  }
});

module.exports = router;