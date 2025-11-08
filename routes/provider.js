const router = require("express").Router();
const { body, query } = require("express-validator");
const validate = require("../middleware/validate");
const providerController = require("../controllers/providerController");

// settings
router.get(
  "/settings",
  [query("phone").notEmpty().withMessage("phone is required"), validate()],
  providerController.getSettings
);

router.post(
  "/settings",
  [
    body("phone").notEmpty().withMessage("phone is required"),
    body("notificationsEnabled").optional().isBoolean(),
    body("soundEnabled").optional().isBoolean(),
    body("maxDistance").optional().isFloat({ min: 10, max: 50 }), // حسب ما اتفقنا
    body("isOnline").optional().isBoolean(),
    validate(),
  ],
  providerController.updateSettings
);

router.post(
  "/status",
  [
    body("phone").notEmpty().withMessage("phone is required"),
    body("status").isIn(["online", "offline"]).withMessage("status must be online or offline"),
    validate(),
  ],
  providerController.updateStatus
);

router.post(
  "/location",
  [
    body("phone").notEmpty().withMessage("phone is required"),
    body("lat").isFloat({ min: -90, max: 90 }).withMessage("lat must be between -90 and 90"),
    body("lng").isFloat({ min: -180, max: 180 }).withMessage("lng must be between -180 and 180"),
    validate(),
  ],
  providerController.updateLocation
);

router.get(
  "/stats",
  [query("phone").notEmpty().withMessage("phone is required"), validate()],
  providerController.getStats
);

module.exports = router;