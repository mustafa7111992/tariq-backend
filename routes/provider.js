// routes/provider.js
const router = require("express").Router();
const { body, query } = require("express-validator");
const validate = require("../middleware/validate");
const providerController = require("../controllers/providerController");

// settings
router.get("/settings", providerController.getSettings);
router.post("/settings", providerController.updateSettings);

// status
router.post("/status", providerController.updateStatus);

// location
router.post(
  "/location",
  [
    body("phone").notEmpty(),
    body("lat").isFloat({ min: -90, max: 90 }),
    body("lng").isFloat({ min: -180, max: 180 }),
    validate,
  ],
  providerController.updateLocation
);

// stats
router.get("/stats", providerController.getStats);

module.exports = router;