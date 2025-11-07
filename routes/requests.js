// routes/requests.js
const express = require("express");
const router = express.Router();
const { body, query, param } = require("express-validator");
const validate = require("../middleware/validate");
const requestController = require("../controllers/requestController");

// POST /api/requests  (إنشاء طلب)
router.post(
  "/",
  [
    body("serviceType").notEmpty().withMessage("serviceType is required"),
    body("notes").optional(),
    body("location.lat").optional().isFloat({ min: -90, max: 90 }),
    body("location.lng").optional().isFloat({ min: -180, max: 180 }),
    body("customerPhone").optional(),
    validate,
  ],
  requestController.createRequest
);

// GET /api/requests  (جلب طلبات عامة)
router.get(
  "/",
  [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
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

// GET /api/requests/by-phone
router.get(
  "/by-phone",
  [query("phone").notEmpty().withMessage("phone is required"), validate],
  requestController.getRequestsByPhone
);

// GET /api/requests/for-provider - 👈 لازم يكون قبل /:id
router.get(
  "/for-provider",
  [
    query("lat").notEmpty(),
    query("lng").notEmpty(),
    query("phone").optional(),
    query("serviceType").optional(),
    query("maxKm").optional().isFloat({ min: 1, max: 200 }),
    validate,
  ],
  requestController.getForProvider
);

// POST /api/requests/:id/cancel  (إلغاء من الزبون)
router.post(
  "/:id/cancel",
  [param("id").isMongoId(), validate],
  requestController.cancelByCustomer
);

// PATCH /api/requests/:id/accept
router.patch(
  "/:id/accept",
  [
    param("id").isMongoId(),
    body("providerPhone").notEmpty().withMessage("providerPhone is required"),
    validate,
  ],
  requestController.acceptRequest
);

// PATCH /api/requests/:id/on-the-way
router.patch(
  "/:id/on-the-way",
  [param("id").isMongoId(), validate],
  requestController.markOnTheWay
);

// PATCH /api/requests/:id/in-progress
router.patch(
  "/:id/in-progress",
  [param("id").isMongoId(), validate],
  requestController.markInProgress
);

// PATCH /api/requests/:id/complete
router.patch(
  "/:id/complete",
  [param("id").isMongoId(), validate],
  requestController.completeRequest
);

// PATCH /api/requests/:id/cancel-by-provider
router.patch(
  "/:id/cancel-by-provider",
  [param("id").isMongoId(), validate],
  requestController.cancelByProvider
);

// POST /api/requests/:id/rate-provider
router.post(
  "/:id/rate-provider",
  [
    param("id").isMongoId(),
    body("score").isInt({ min: 1, max: 5 }),
    body("comment").optional(),
    validate,
  ],
  requestController.rateProvider
);

// POST /api/requests/:id/rate-customer
router.post(
  "/:id/rate-customer",
  [
    param("id").isMongoId(),
    body("score").isInt({ min: 1, max: 5 }),
    body("comment").optional(),
    validate,
  ],
  requestController.rateCustomer
);

// 👈 أهم سطر
module.exports = router;