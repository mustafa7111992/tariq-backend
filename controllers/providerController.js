// controllers/providerController.js
const Provider = require('../models/Provider');

// نوحّد الرقم مثل باقي الملفات
function normalizePhone(raw) {
  if (!raw) return null;
  const p = raw.trim().replace(/\s+/g, '');
  if (p.startsWith('07')) return `+964${p.slice(1)}`;
  if (p.startsWith('+')) return /^\+[0-9]+$/.test(p) ? p : null;
  return /^[0-9]+$/.test(p) ? p : null;
}

// POST /api/providers/register
exports.registerProvider = async (req, res) => {
  try {
    const { phone, name, serviceType, city } = req.body;

    const normalized = normalizePhone(phone);
    if (!normalized) {
      return res.status(400).json({ ok: false, error: 'invalid phone' });
    }

    let provider = await Provider.findOne({ phone: normalized });

    if (provider) {
      // موجود؟ نحدّث بياناته
      provider.name = name || provider.name;
      provider.serviceType = serviceType || provider.serviceType;
      provider.city = city || provider.city;
      await provider.save();
    } else {
      // مو موجود؟ نسوي واحد جديد
      provider = await Provider.create({
        phone: normalized,
        name,
        serviceType: serviceType || null,
        city: city || null,
      });
    }

    return res.json({ ok: true, provider });
  } catch (err) {
    console.error('registerProvider error:', err);
    return res.status(500).json({ ok: false, error: 'internal error' });
  }
};

// GET /api/providers/check?phone=...
exports.checkProvider = async (req, res) => {
  try {
    const { phone } = req.query;
    const normalized = normalizePhone(phone);
    if (!normalized) {
      return res.status(400).json({ ok: false, error: 'invalid phone' });
    }

    const provider = await Provider.findOne({ phone: normalized }).lean();
    if (!provider) {
      return res.status(404).json({ ok: false, error: 'provider not found' });
    }

    return res.json({ ok: true, provider });
  } catch (err) {
    console.error('checkProvider error:', err);
    return res.status(500).json({ ok: false, error: 'internal error' });
  }
};

// GET /api/providers (اختياري – للوحة تحكم)
exports.listProviders = async (req, res) => {
  try {
    const { serviceType, city, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (serviceType) filter.serviceType = serviceType;
    if (city) filter.city = city;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [items, total] = await Promise.all([
      Provider.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Provider.countDocuments(filter),
    ]);

    return res.json({
      ok: true,
      items,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    console.error('listProviders error:', err);
    return res.status(500).json({ ok: false, error: 'internal error' });
  }
};