import { validationResult } from 'express-validator';
import { errorResponse } from '../utils/apiResponse.js';

/**
 * Middleware to convert FormData string values to proper types before validation
 * This handles the case where form data sends boolean values as strings 'true'/'false'
 */
export const normalizeFormData = (req, res, next) => {
  try {
    if (req.is('multipart/form-data')) {
      const booleanFields = ['prescriptionRequired', 'isFeatured', 'isNewArrival', 'isBestSeller', 'isActive'];
      const numberFields = ['price', 'comparePrice', 'stock'];
      
      console.log('Before normalization:', req.body);
      
      booleanFields.forEach(field => {
        if (req.body[field] !== undefined && req.body[field] !== '') {
          const value = req.body[field];
          req.body[field] = value === 'true' || value === true || value === '1';
        }
      });
      
      numberFields.forEach(field => {
        if (req.body[field] !== undefined && req.body[field] !== '') {
          const value = parseFloat(req.body[field]);
          req.body[field] = isNaN(value) ? 0 : value;
        }
      });
      
      console.log('After normalization:', req.body);
    }
    next();
  } catch (error) {
    console.error('FormData normalization error:', error);
    next(error);
  }
};

/**
 * Middleware to check validation results from express-validator
 */
export const validate = (req, res, next) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const formattedErrors = errors.array().map((err) => ({
        field: err.path || err.param,
        message: err.msg,
      }));

      console.error('Validation errors:', formattedErrors);
      return errorResponse(res, 'Validation failed', 422, formattedErrors);
    }

    next();
  } catch (error) {
    console.error('Validation middleware error:', error);
    next(error);
  }
};
