// routes/customers.js
const router = require("express").Router();
const { body, query } = require("express-validator");
const validate = require("../middleware/validate");
const Customer = require("../models/Customer");

// helper لتوحيد الرقم
function normalizePhone(raw) {
  if (!raw) return null;
  const p = raw.trim().replace(/\s+/g, "");

  // عراقي 07...
  if (p.startsWith("07")) {
    return `+964${p.slice(1)}`;
  }

  // دولي +
  if (p.startsWith("+")) {
    if (!/^\+[0-9]+$/.test(p)) return null;
    return p;
  }

  // أرقام بس
  if (!/^[0-9]+$/.test(p)) return null;
  return p;
}

/**
 * 1) POST /api/customers
 * هذا اللي التطبيق يستعمله بالتسجيل
 */
router.post(
  "/",
  [
    body("phone").notEmpty().withMessage("phone is required"),
    body("name").notEmpty().withMessage("name is required"),
    validate(),
  ],
  async (req, res) => {
    try {
      const { phone, name, email, avatar } = req.body;
      const normalized = normalizePhone(phone);
      if (!normalized) {
        return res.status(400).json({ ok: false, error: "invalid phone" });
      }

      let customer = await Customer.findOne({ phone: normalized });
      if (customer) {
        // موجود → نحدّث بس
        customer.name = name;
        if (email) customer.email = email;
        if (avatar) customer.avatar = avatar;
        await customer.save();
      } else {
        customer = await Customer.create({
          phone: normalized,
          name,
          email: email || undefined,
          avatar: avatar || undefined,
          isVerified: false,
        });
      }

      return res.status(customer.isNew ? 201 : 200).json({
        ok: true,
        customer,
      });
    } catch (err) {
      console.error("customer create error:", err);
      return res.status(500).json({ ok: false, error: "internal error" });
    }
  }
);

/**
 * 2) GET /api/customers/check?phone=...
 * التطبيق يسويها قبل ما يرسل الكود
 */
router.get(
  "/check",
  [query("phone").notEmpty().withMessage("phone is required"), validate()],
  async (req, res) => {
    try {
      const normalized = normalizePhone(req.query.phone);
      if (!normalized) {
        return res.status(400).json({ ok: false, error: "invalid phone" });
      }

      const customer = await Customer.findOne({ phone: normalized }).lean();
      if (!customer) {
        return res.status(404).json({ ok: false, error: "customer not found" });
      }

      return res.json({ ok: true, customer });
    } catch (err) {
      console.error("customer check error:", err);
      return res.status(500).json({ ok: false, error: "internal error" });
    }
  }
);

/**
 * 3) النسخ القديمة مالك – نخليها حتى ما تنكسر
 * POST /api/customers/register
 * GET  /api/customers/by-phone
 */
router.post(
  "/register",
  [
    body("phone").notEmpty().withMessage("phone is required"),
    body("name").notEmpty().withMessage("name is required"),
    validate(),
  ],
  async (req, res) => {
    try {
      const { phone, name, email, avatar } = req.body;
      const normalized = normalizePhone(phone);
      if (!normalized) {
        return res.status(400).json({ ok: false, error: "invalid phone" });
      }

      let customer = await Customer.findOne({ phone: normalized });
      if (customer) {
        customer.name = name;
        if (email) customer.email = email;
        if (avatar) customer.avatar = avatar;
        await customer.save();
      } else {
        customer = await Customer.create({
          phone: normalized,
          name,
          email: email || undefined,
          avatar: avatar || undefined,
          isVerified: false,
        });
      }

      return res.json({ ok: true, customer });
    } catch (err) {
      console.error("customer register error:", err);
      return res.status(500).json({ ok: false, error: "internal error" });
    }
  }
);

router.get(
  "/by-phone",
  [query("phone").notEmpty().withMessage("phone is required"), validate()],
  async (req, res) => {
    try {
      const normalized = normalizePhone(req.query.phone);
      if (!normalized) {
        return res.status(400).json({ ok: false, error: "invalid phone" });
      }

      const customer = await Customer.findOne({ phone: normalized }).lean();
      if (!customer) {
        return res.status(404).json({ ok: false, error: "customer not found" });
      }
      return res.json({ ok: true, customer });
    } catch (err) {
      console.error("get customer error:", err);
      return res.status(500).json({ ok: false, error: "internal error" });
    }
  }
);

module.exports = router;