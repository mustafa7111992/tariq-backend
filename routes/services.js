// routes/services.js
const router = require("express").Router();
const serviceController = require("../controllers/serviceController");

router.get("/", serviceController.getServices);

module.exports = router;