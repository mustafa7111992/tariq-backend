// middleware/validate.js
const { validationResult } = require('express-validator');
const { fail } = require('../utils/helpers');

module.exports = function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return fail(res, errors.array()[0].msg, 400, req);
  }
  next();
};