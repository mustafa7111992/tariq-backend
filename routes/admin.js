// routes/admin.js
const router = require("express").Router();
const adminController = require("../controllers/adminController");

// الإحصائيات والتقارير
router.get("/overview", adminController.getOverview);
router.get("/detailed-stats", adminController.getDetailedStats);

// سجل الأنشطة
router.get("/activity", adminController.getActivity);

// إدارة المستخدمين
router.post("/manage-user", adminController.manageUser);

// إدارة النظام
router.post("/clear-cache", adminController.clearCache);

module.exports = router;