// routes/users.js
const router = require("express").Router();
const { body, query } = require("express-validator");
const validate = require("../middleware/validate");
const userController = require("../controllers/userController");

router.post(
  "/",
  [
    body("phone").notEmpty().withMessage("phone is required"),
    body("role").optional().isIn(["customer", "provider", "admin"]),
    validate(),
  ],
  userController.createOrLoginUser
);

router.get(
  "/",
  [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    validate(),
  ],
  userController.getUsers
);

module.exports = router;