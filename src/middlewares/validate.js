import { validationResult } from 'express-validator';
import { errorResponse } from '../utils/apiResponse.js';

/**
 * Middleware to convert FormData string values to proper types before validation
 * This handles the case where form data sends boolean values as strings 'true'/'false'
 */
export const normalizeFormData = (req, res, next) => {
  if (req.is('multipart/form-data')) {
    const booleanFields = ['prescriptionRequired', 'isFeatured', 'isNewArrival', 'isBestSeller', 'isActive'];
    const numberFields = ['price', 'comparePrice', 'stock'];
    
    booleanFields.forEach(field => {
      if (req.body[field] !== undefined) {
        req.body[field] = req.body[field] === 'true' || req.body[field] === true;
      }
    });
    
    numberFields.forEach(field => {
      if (req.body[field] !== undefined && req.body[field] !== '') {
        req.body[field] = parseFloat(req.body[field]);
      }
    });
  }
  next();
};

/**
 * Middleware to check validation results from express-validator
 */
export const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
    }));

    return errorResponse(res, 'Validation failed', 422, formattedErrors);
  }

  next();
};
