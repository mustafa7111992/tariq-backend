// routes/admin.js
const router = require("express").Router();
const adminController = require("../controllers/adminController");

router.get("/overview", adminController.getOverview);
router.get("/activity", adminController.getActivity);
router.post("/clear-cache", adminController.clearCache);

module.exports = router;