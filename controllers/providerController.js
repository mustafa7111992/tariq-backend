// controllers/providerController.js
const Provider = require("../models/Provider"); // 👈 تأكد ضايفه فوق

// نفس دالة توحيد الرقم اللي عندك
function normalizePhone(raw) {
  if (!raw) return null;
  const p = raw.trim().replace(/\s+/g, "");

  if (p.startsWith("07")) return `+964${p.slice(1)}`;
  if (p.startsWith("+")) {
    if (!/^\+[0-9]+$/.test(p)) return null;
    return p;
  }
  if (!/^[0-9]+$/.test(p)) return null;
  return p;
}

// POST /api/providers/register
// body: { phone, name?, serviceType?, city? }
exports.registerProvider = async (req, res) => {
  try {
    const { phone, name, serviceType, city } = req.body;

    const normalized = normalizePhone(phone);
    if (!normalized) {
      return res.status(400).json({ ok: false, error: "invalid phone format" });
    }

    // إذا موجود رجّعه
    let provider = await Provider.findOne({ phone: normalized });
    if (provider) {
      // نحدّث بياناته لو جاي من التطبيق أول مرة
      let updated = false;
      if (name && !provider.name) {
        provider.name = name;
        updated = true;
      }
      if (serviceType && !provider.serviceType) {
        provider.serviceType = serviceType;
        updated = true;
      }
      if (city && !provider.city) {
        provider.city = city;
        updated = true;
      }
      if (updated) await provider.save();
      return res.json({ ok: true, data: provider });
    }

    // ما موجود → نسوي واحد جديد
    provider = await Provider.create({
      phone: normalized,
      name: name || "مزود",
      serviceType: serviceType || null,
      city: city || null,
      isActive: true,
    });

    return res.json({ ok: true, data: provider });
  } catch (err) {
    console.error("registerProvider error:", err);
    return res.status(500).json({ ok: false, error: "internal error" });
  }
};

// GET /api/providers?phone=...
exports.getProviderByPhone = async (req, res) => {
  try {
    const { phone } = req.query;
    const normalized = normalizePhone(phone);
    if (!normalized) {
      return res.status(400).json({ ok: false, error: "invalid phone format" });
    }

    const provider = await Provider.findOne({ phone: normalized }).lean();
    if (!provider) {
      return res.status(404).json({ ok: false, error: "provider not found" });
    }

    return res.json({ ok: true, data: provider });
  } catch (err) {
    console.error("getProviderByPhone error:", err);
    return res.status(500).json({ ok: false, error: "internal error" });
  }
};