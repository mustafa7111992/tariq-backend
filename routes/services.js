// routes/services.js
const router = require("express").Router();
const { query } = require("express-validator");
const validate = require("../middleware/validate");
const serviceController = require("../controllers/serviceController");

// GET /api/services - جلب قائمة الخدمات
router.get(
  "/",
  [
    query("category").optional().isIn(["طوارئ", "صيانة", "أخرى"]),
    query("format").optional().isIn(["json", "simple"]),
    validate,
  ],
  serviceController.getServices
);

module.exports = router;