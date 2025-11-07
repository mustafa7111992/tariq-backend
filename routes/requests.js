// routes/requests.js
const router = require("express").Router();
const { body, query, param } = require("express-validator");
const validate = require("../middleware/validate");

// ناخذ الدوال وحده وحده حتى إذا وحدة مو موجودة نعرف
const {
  createRequest,
  getRequests,
  getRequestsByPhone,
  cancelByCustomer,
  getForProvider,
  acceptRequest,
  markOnTheWay,
  markInProgress,
  completeRequest,
  cancelByProvider,
  rateProvider,
  rateCustomer,
} = require("../controllers/requestController");

// إنشاء طلب
router.post(
  "/",
  [
    body("serviceType").notEmpty().withMessage("serviceType is required"),
    body("customerPhone").optional(),
    validate,
  ],
  createRequest
);

// جلب الطلبات (للوحة الادمن أو للفحص)
router.get(
  "/",
  [
    query("page").optional().isInt({ min: 1 }),
    query("status")
      .optional()
      .isIn([
        "pending",
        "accepted",
        "on-the-way",
        "in-progress",
        "done",
        "cancelled",
      ]),
    validate,
  ],
  getRequests
);

// طلبات حسب رقم الزبون
router.get(
  "/by-phone",
  [query("phone").notEmpty(), validate],
  getRequestsByPhone
);

// إلغاء من الزبون
router.post(
  "/:id/cancel",
  [param("id").isMongoId(), validate],
  cancelByCustomer
);

// الطلبات للمزوّد (القريبة)
router.get(
  "/for-provider",
  [
    query("lat").notEmpty(),
    query("lng").notEmpty(),
    query("phone").optional(),
    validate,
  ],
  getForProvider
);

// قبول طلب من المزود
router.patch(
  "/:id/accept",
  [param("id").isMongoId(), body("providerPhone").notEmpty(), validate],
  acceptRequest
);

// في الطريق
router.patch("/:id/on-the-way", markOnTheWay);

// قيد التنفيذ
router.patch("/:id/in-progress", markInProgress);

// إنهاء الطلب
router.patch("/:id/complete", completeRequest);

// إلغاء من المزوّد
router.patch("/:id/cancel-by-provider", cancelByProvider);

// تقييم المزود
router.post(
  "/:id/rate-provider",
  [param("id").isMongoId(), body("score").isInt({ min: 1, max: 5 }), validate],
  rateProvider
);

// تقييم الزبون
router.post("/:id/rate-customer", rateCustomer);

module.exports = router;