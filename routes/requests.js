const express = require("express");
const router = express.Router();
const { body, query, param } = require("express-validator");
const validate = require("../middleware/validate");
const requestController = require("../controllers/requestController");

// create
router.post(
  "/",
  [
    body("serviceType").notEmpty().withMessage("serviceType is required"),
    validate,
  ],
  requestController.createRequest
);

// list
router.get(
  "/",
  [query("page").optional().isInt({ min: 1 }), validate],
  requestController.getRequests
);

// by phone
router.get(
  "/by-phone",
  [query("phone").notEmpty(), validate],
  requestController.getRequestsByPhone
);

// cancel by customer  👈 نستخدم اسمك الفعلي
router.post(
  "/:id/cancel",
  [param("id").isMongoId(), validate],
  requestController.cancelRequestByCustomer
);

// for provider 👈 نستخدم اسمك الفعلي
router.get(
  "/for-provider",
  [
    query("lat").notEmpty(),
    query("lng").notEmpty(),
    query("phone").optional(),
    validate,
  ],
  requestController.getRequestsForProvider
);

// accept
router.patch(
  "/:id/accept",
  [
    param("id").isMongoId(),
    body("providerPhone").notEmpty(),
    validate,
  ],
  requestController.acceptRequest
);

// on-the-way 👈 نستخدم اسمك الفعلي
router.patch(
  "/:id/on-the-way",
  [param("id").isMongoId(), validate],
  requestController.setOnTheWay
);

// in-progress 👈 نستخدم اسمك الفعلي
router.patch(
  "/:id/in-progress",
  [param("id").isMongoId(), validate],
  requestController.setInProgress
);

// complete
router.patch(
  "/:id/complete",
  [param("id").isMongoId(), validate],
  requestController.completeRequest
);

// cancel by provider
router.patch(
  "/:id/cancel-by-provider",
  [param("id").isMongoId(), validate],
  requestController.cancelByProvider
);

// rate provider
router.post(
  "/:id/rate-provider",
  [
    param("id").isMongoId(),
    body("score").isInt({ min: 1, max: 5 }),
    validate,
  ],
  requestController.rateProvider
);

// rate customer
router.post(
  "/:id/rate-customer",
  [
    param("id").isMongoId(),
    body("score").isInt({ min: 1, max: 5 }),
    validate,
  ],
  requestController.rateCustomer
);

module.exports = router;