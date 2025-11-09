// controllers/customerController.js
const Customer = require('../models/Customer');
const { ok, fail } = require('../utils/helpers');

// توحيد الرقم مثل باقي الأماكن
function normalizePhone(raw) {
  if (!raw) return null;
  const p = raw.trim().replace(/\s+/g, '');

  if (p.startsWith('07')) {
    return `+964${p.slice(1)}`;
  }
  if (p.startsWith('+')) {
    if (!/^\+[0-9]+$/.test(p)) return null;
    return p;
  }
  if (!/^[0-9]+$/.test(p)) return null;
  return p;
}

// POST /api/customers/register
// body: { phone, name }
exports.registerCustomer = async (req, res) => {
  try {
    const { phone, name, email } = req.body;

    const normalized = normalizePhone(phone);
    if (!normalized) {
      return fail(res, 'invalid phone format', 400, req);
    }

    // إذا موجود رجّعه
    let customer = await Customer.findOne({ phone: normalized });
    if (customer) {
      // ممكن نحدّث الاسم لو جاي من التطبيق
      if (name && !customer.name) {
        customer.name = name;
        await customer.save();
      }
      return ok(res, customer);
    }

    // إذا ما موجود سوّيه
    customer = await Customer.create({
      phone: normalized,
      name: name || 'بدون اسم',
      email: email || null,
      isVerified: false,
    });

    return ok(res, customer);
  } catch (err) {
    console.error('registerCustomer error:', err);
    return fail(res, 'internal error', 500, req);
  }
};

// GET /api/customers?phone=...
exports.getCustomer = async (req, res) => {
  try {
    const { phone } = req.query;
    const normalized = normalizePhone(phone);
    if (!normalized) {
      return fail(res, 'invalid phone format', 400, req);
    }

    const customer = await Customer.findOne({ phone: normalized }).lean();
    if (!customer) {
      return fail(res, 'customer not found', 404, req);
    }

    return ok(res, customer);
  } catch (err) {
    console.error('getCustomer error:', err);
    return fail(res, 'internal error', 500, req);
  }
};