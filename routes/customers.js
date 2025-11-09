// routes/customers.js
const router = require("express").Router();
const { body, query, param } = require("express-validator");
const validate = require("../middleware/validate");
const Customer = require("../models/Customer");

// POST /api/customers/register
// أول تسجيل للزبون
router.post(
  "/register",
  [
    body("phone").notEmpty().withMessage("phone is required"),
    body("name").notEmpty().withMessage("name is required"),
    validate(), // مهم
  ],
  async (req, res) => {
    try {
      const { phone, name, email, avatar } = req.body;

      // نحاول نلقاه
      let customer = await Customer.findOne({ phone });
      if (customer) {
        // موجود؟ نحدّث الاسم والباقي فقط
        customer.name = name;
        if (email) customer.email = email;
        if (avatar) customer.avatar = avatar;
        await customer.save();
      } else {
        // مو موجود؟ نسوي واحد جديد
        customer = await Customer.create({
          phone,
          name,
          email: email || undefined,
          avatar: avatar || undefined,
          isVerified: false,
        });
      }

      return res.json({
        ok: true,
        customer,
      });
    } catch (err) {
      console.error("customer register error:", err);
      return res.status(500).json({ ok: false, error: "internal error" });
    }
  }
);

// GET /api/customers/by-phone?phone=...
router.get(
  "/by-phone",
  [query("phone").notEmpty().withMessage("phone is required"), validate()],
  async (req, res) => {
    try {
      const { phone } = req.query;
      const customer = await Customer.findOne({ phone }).lean();
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