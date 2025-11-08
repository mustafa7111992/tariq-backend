// NOTE: Current startup warning about duplicate phone index comes from a schema file, not this validator.
const { validationResult } = require('express-validator');

function validate(rules) {
  // Normalize to array
  const chains = Array.isArray(rules) ? rules : [rules];

  return async (req, res, next) => {
    try {
      // Run all validation chains
      await Promise.all(chains.map(chain => chain.run(req)));

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = validate;