// middleware/validate.js
const { validationResult } = require('express-validator');
const { fail } = require('../utils/helpers');

/**
 * Validation middleware using express-validator
 * Supports multiple validation modes and detailed error reporting
 */
module.exports = function validate(options = {}) {
  const {
    mode = 'first', // 'first', 'all', 'formatted'
    sanitize = true,
    logErrors = true
  } = options;

  return function(req, res, next) {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      const errorArray = errors.array();
      
      // Log validation errors for debugging
      if (logErrors) {
        console.warn('🔍 Validation Error:', {
          requestId: req.requestId,
          method: req.method,
          url: req.url,
          ip: req.ip,
          errors: errorArray.map(err => ({
            field: err.path || err.param,
            value: err.value,
            message: err.msg,
            location: err.location
          }))
        });
      }
      
      // Format errors based on mode
      switch (mode) {
        case 'all':
          return fail(res, 'Validation failed', 400, req, {
            errors: errorArray.map(err => ({
              field: err.path || err.param,
              message: err.msg,
              value: err.value,
              location: err.location
            }))
          });
          
        case 'formatted':
          const formattedErrors = {};
          errorArray.forEach(err => {
            const field = err.path || err.param;
            if (!formattedErrors[field]) {
              formattedErrors[field] = [];
            }
            formattedErrors[field].push(err.msg);
          });
          
          return fail(res, 'Validation failed', 400, req, {
            errors: formattedErrors
          });
          
        case 'first':
        default:
          return fail(res, errorArray[0].msg, 400, req, {
            field: errorArray[0].path || errorArray[0].param,
            value: errorArray[0].value
          });
      }
    }
    
    // Sanitize request data if enabled
    if (sanitize) {
      sanitizeRequest(req);
    }
    
    next();
  };
};

/**
 * Simple validation middleware for backward compatibility
 */
module.exports.simple = function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return fail(res, errors.array()[0].msg, 400, req);
  }
  next();
};

/**
 * Sanitize request data by trimming strings and removing empty values
 */
function sanitizeRequest(req) {
  const sanitizeObject = (obj) => {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (typeof obj[key] === 'string') {
          obj[key] = obj[key].trim();
          // Remove empty strings
          if (obj[key] === '') {
            delete obj[key];
          }
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitizeObject(obj[key]);
        }
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