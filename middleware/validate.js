// middleware/validate.js
const { validationResult } = require('express-validator');
const { fail } = require('../utils/helpers');

module.exports = function validate(options = {}) {
  const {
    mode = 'first', // 'first', 'all', 'formatted'
    sanitize = true,
    logErrors = true,
  } = options;

  return function (req, res, next) {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const errorArray = errors.array();

      if (logErrors) {
        console.warn('🔍 Validation Error:', {
          requestId: req.id, // 👈 هنا
          method: req.method,
          url: req.url,
          ip: req.ip,
          errors: errorArray.map((err) => ({
            field: err.path || err.param,
            value: err.value,
            message: err.msg,
            location: err.location,
          })),
        });
      }

      switch (mode) {
        case 'all':
          return fail(res, 'Validation failed', 400, req, {
            errors: errorArray.map((err) => ({
              field: err.path || err.param,
              message: err.msg,
              value: err.value,
              location: err.location,
            })),
          });

        case 'formatted': {
          const formattedErrors = {};
          errorArray.forEach((err) => {
            const field = err.path || err.param;
            if (!formattedErrors[field]) {
              formattedErrors[field] = [];
            }
            formattedErrors[field].push(err.msg);
          });
          return fail(res, 'Validation failed', 400, req, {
            errors: formattedErrors,
          });
        }

        case 'first':
        default:
          return fail(res, errorArray[0].msg, 400, req, {
            field: errorArray[0].path || errorArray[0].param,
            value: errorArray[0].value,
          });
      }
    }

    if (sanitize) {
      sanitizeRequest(req);
    }

    next();
  };
};

// نسخة بسيطة
module.exports.simple = function validateSimple(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return fail(res, errors.array()[0].msg, 400, req);
  }
  next();
};

function sanitizeRequest(req) {
  const sanitizeObject = (obj) => {
    for (const key in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;

      if (typeof obj[key] === 'string') {
        obj[key] = obj[key].trim();
        // لو ما تبي تحذف الفارغ، اشيل هالـ if
        if (obj[key] === '') {
          delete obj[key];
        }
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    }
  };

  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    sanitizeObject(req.query);
  }
}