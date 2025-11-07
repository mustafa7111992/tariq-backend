// routes/requests.js
const express = require("express");
const { body, query, param } = require("express-validator");
const validate = require("../middleware/validate");
const requestController = require("../controllers/requestController");

const router = express.Router();

// إنشاء طلب
router.post(
  "/",
  [
    body("serviceType").notEmpty().withMessage("serviceType is required"),
    body("customerPhone").optional().isString(),
    body("notes").optional().isString(),
    body("city").optional().isString(),
    body("location.lat").optional().isFloat(),
    body("location.lng").optional().isFloat(),
    validate,
  ],
  requestController.createRequest
);

// جلب الطلبات (للوحة المزود/الأدمن)
router.get(
  "/",
  [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 200 }),
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
    query("serviceType").optional().isString(),
    validate,
  ],
  requestController.getRequests
);

// جلب طلبات رقم معيّن
router.get(
  "/by-phone",
  [query("phone").notEmpty().withMessage("phone is required"), validate],
  requestController.getRequestsByPhone
);

// إلغاء من الزبون
router.post(
  "/:id/cancel",
  [param("id").isMongoId(), validate],
  requestController.cancelByCustomer
);

// للـ provider: جلب القريبة
router.get(
  "/for-provider",
  [
    query("lat").notEmpty().withMessage("lat is required"),
    query("lng").notEmpty().withMessage("lng is required"),
    query("phone").optional(),
    query("serviceType").optional(),
    query("maxKm").optional().isFloat({ min: 1 }),
    validate,
  ],
  requestController.getForProvider
);

// قبول الطلب
router.patch(
  "/:id/accept",
  [
    param("id").isMongoId(),
    body("providerPhone").notEmpty().withMessage("providerPhone is required"),
    validate,
  ],
  requestController.acceptRequest
);

// في الطريق
router.patch(
  "/:id/on-the-way",
  [param("id").isMongoId(), validate],
  requestController.markOnTheWay
);

// قيد التنفيذ
router.patch(
  "/:id/in-progress",
  [param("id").isMongoId(), validate],
  requestController.markInProgress
);

// إنهاء
router.patch(
  "/:id/complete",
  [param("id").isMongoId(), validate],
  requestController.completeRequest
);

// إلغاء من المزود
router.patch(
  "/:id/cancel-by-provider",
  [param("id").isMongoId(), validate],
  requestController.cancelByProvider
);

module.exports = router;