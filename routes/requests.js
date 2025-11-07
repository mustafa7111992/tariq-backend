// routes/requests.js
const router = require("express").Router();
const { body, query, param } = require("express-validator");
const validate = require("../middleware/validate");
const requestController = require("../controllers/requestController");

// إنشاء طلب
router.post(
  "/",
  [
    body("serviceType").notEmpty().withMessage("serviceType is required"),
    body("customerPhone").optional(),
    body("location.lat").optional().isFloat({ min: -90, max: 90 }),
    body("location.lng").optional().isFloat({ min: -180, max: 180 }),
    validate,
  ],
  requestController.createRequest
);

// جلب الطلبات (للوحة الأدمن مثلاً)
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
    query("serviceType").optional(),
    validate,
  ],
  requestController.getRequests
);

// طلبات زبون معيّن
router.get(
  "/by-phone",
  [query("phone").notEmpty(), validate],
  requestController.getRequestsByPhone
);

// إلغاء من الزبون
router.post(
  "/:id/cancel",
  [param("id").isMongoId(), body("phone").optional(), validate],
  requestController.cancelByCustomer
);

// الطلبات للمزوّد
router.get(
  "/for-provider",
  [
    query("lat").notEmpty().isFloat({ min: -90, max: 90 }),
    query("lng").notEmpty().isFloat({ min: -180, max: 180 }),
    query("phone").optional(),
    query("serviceType").optional(),
    validate,
  ],
  requestController.getForProvider
);

// قبول الطلب
router.patch(
  "/:id/accept",
  [
    param("id").isMongoId(),
    body("providerPhone").notEmpty(),
    validate,
  ],
  requestController.acceptRequest
);

// في الطريق
router.patch(
  "/:id/on-the-way",
  [
    param("id").isMongoId(),
    body("providerPhone").optional(),
    validate,
  ],
  requestController.markOnTheWay
);

// قيد التنفيذ
router.patch(
  "/:id/in-progress",
  [
    param("id").isMongoId(),
    body("providerPhone").optional(),
    validate,
  ],
  requestController.markInProgress
);

// إنهاء الطلب
router.patch(
  "/:id/complete",
  [
    param("id").isMongoId(),
    body("providerPhone").optional(),
    validate,
  ],
  requestController.completeRequest
);

// إلغاء من المزوّد
router.patch(
  "/:id/cancel-by-provider",
  [
    param("id").isMongoId(),
    body("providerPhone").optional(),
    validate,
  ],
  requestController.cancelByProvider
);

// تقييم المزوّد
router.post(
  "/:id/rate-provider",
  [
    param("id").isMongoId(),
    body("score").isInt({ min: 1, max: 5 }),
    body("comment").optional().trim(),
    body("phone").optional(),
    validate,
  ],
  requestController.rateProvider
);

// تقييم الزبون
router.post(
  "/:id/rate-customer",
  [
    param("id").isMongoId(),
    body("score").isInt({ min: 1, max: 5 }),
    body("comment").optional().trim(),
    body("phone").optional(),
    validate,
  ],
  requestController.rateCustomer
);

module.exports = router;