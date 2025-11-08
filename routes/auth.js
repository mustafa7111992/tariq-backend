// routes/auth.js
const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { firebaseLogin } = require('../controllers/authController');

const router = express.Router();

router.post(
  '/firebase-login',
  [
    body('phone').notEmpty().withMessage('phone required'),
    body('idToken').notEmpty().withMessage('idToken required'),
    validate,
  ],
  firebaseLogin
);

module.exports = router;