// routes/requests.js
const router = require("express").Router();
const { body, query, param } = require("express-validator");
const validate = require("../middleware/validate");
const requestController = require("../controllers/requestController");

// create
router.post(
  "/",
  [
    body("serviceType").notEmpty().withMessage("serviceType is required"),
    body("customerPhone").optional(),
    validate,
  ],
  requestController.createRequest
);

// list
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
  requestController.getRequests
);

// by customer
router.get(
  "/by-phone",
  [query("phone").notEmpty(), validate],
  requestController.getRequestsByPhone
);

// cancel by customer
router.post(
  "/:id/cancel",
  [param("id").isMongoId(), validate],
  requestController.cancelByCustomer
);

// for provider
router.get(
  "/for-provider",
  [
    query("lat").notEmpty(),
    query("lng").notEmpty(),
    query("phone").optional(),
    validate,
  ],
  requestController.getForProvider
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

// on-the-way
router.patch("/:id/on-the-way", requestController.markOnTheWay);

// in-progress
router.patch("/:id/in-progress", requestController.markInProgress);

// complete
router.patch("/:id/complete", requestController.completeRequest);

// cancel by provider
router.patch("/:id/cancel-by-provider", requestController.cancelByProvider);

// rate provider
router.post(
  "/:id/rate-provider",
  [param("id").isMongoId(), body("score").isInt({ min: 1, max: 5 }), validate],
  requestController.rateProvider
);

// rate customer
router.post("/:id/rate-customer", requestController.rateCustomer);

module.exports = router;