// routes/providers.js
const router = require("express").Router();
const { body, query } = require("express-validator");
const validate = require("../middleware/validate");
const Provider = require("../models/Provider");

// POST /api/providers/register
router.post(
  "/register",
  [
    body("phone").notEmpty().withMessage("phone is required"),
    body("name").notEmpty().withMessage("name is required"),
    body("serviceType").optional().isString(),
    validate(),
  ],
  async (req, res) => {
    try {
      const { phone, name, serviceType, city } = req.body;

      let provider = await Provider.findOne({ phone });
      if (provider) {
        provider.name = name;
        if (serviceType) provider.serviceType = serviceType;
        if (city) provider.city = city;
        await provider.save();
      } else {
        provider = await Provider.create({
          phone,
          name,
          serviceType: serviceType || null,
          city: city || null,
          isActive: true,
        });
      }

      return res.json({ ok: true, provider });
    } catch (err) {
      console.error("provider register error:", err);
      return res.status(500).json({ ok: false, error: "internal error" });
    }
  }
);

// GET /api/providers/by-phone
router.get(
  "/by-phone",
  [query("phone").notEmpty().withMessage("phone is required"), validate()],
  async (req, res) => {
    try {
      const { phone } = req.query;
      const provider = await Provider.findOne({ phone }).lean();
      if (!provider) {
        return res.status(404).json({ ok: false, error: "provider not found" });
      }
      return res.json({ ok: true, provider });
    } catch (err) {
      console.error("get provider error:", err);
      return res.status(500).json({ ok: false, error: "internal error" });
    }
  }
);

module.exports = router;