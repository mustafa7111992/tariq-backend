// routes/users.js
const router = require("express").Router();
const { body, query, param } = require("express-validator");
const validate = require("../middleware/validate");
const userController = require("../controllers/userController");

// PUT /api/users - تحديث بيانات المستخدم بعد التحقق من OTP
router.put(
  "/",
  [
    body("userId").isMongoId().withMessage("valid userId is required"),
    body("name").optional().isString().trim().isLength({ min: 1, max: 100 }),
    body("serviceType").optional().isString().trim(),
    body("city").optional().isString().trim(),
    validate,
  ],
  userController.updateUser
);

// GET /api/users/:id - الحصول على معلومات مستخدم محدد
router.get(
  "/:id",
  [
    param("id").isMongoId().withMessage("valid user ID is required"),
    validate,
  ],
  userController.getUserById
);

// GET /api/users - جلب قائمة المستخدمين (للإدارة)
router.get(
  "/",
  [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("role").optional().isIn(["customer", "provider", "admin"]),
    query("search").optional().isString().trim(),
    validate,
  ],
  userController.getUsers
);

module.exports = router;