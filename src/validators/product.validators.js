import { body } from 'express-validator';

// Skip validation for update - handle it in the controller
export const createProductValidator = [
  body('categoryId').notEmpty().withMessage('Category is required').isUUID().withMessage('Invalid category ID'),
  body('name').trim().notEmpty().withMessage('Product name is required').isLength({ min: 2, max: 200 }),
  body('price').notEmpty().withMessage('Price is required').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('stock').optional().isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
];

export const updateProductValidator = [
  // Minimal validation for update - most validation happens in controller
  body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('stock').optional().isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
];

export const createCategoryValidator = [
  body('name').trim().notEmpty().withMessage('Category name is required').isLength({ min: 2, max: 100 }),
];

export const createOrderValidator = [
  body('deliveryAddress').trim().notEmpty().withMessage('Delivery address is required'),
  body('deliveryPhone')
    .trim()
    .notEmpty().withMessage('Delivery phone is required')
    .matches(/^(\+?234|0)[789]\d{9}$/).withMessage('Invalid phone number'),
];

export const addToCartValidator = [
  body('productId').notEmpty().withMessage('Product ID is required').isUUID().withMessage('Invalid product ID'),
  body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
];

export const createAddressValidator = [
  body('fullname').trim().notEmpty().withMessage('Full name is required'),
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  body('street').trim().notEmpty().withMessage('Street address is required'),
  body('city').trim().notEmpty().withMessage('City is required'),
  body('state').trim().notEmpty().withMessage('State is required'),
];

export const createReviewValidator = [
  body('productId').notEmpty().withMessage('Product ID is required').isUUID(),
  body('rating').notEmpty().withMessage('Rating is required').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'),
  body('comment').optional().isLength({ max: 1000 }),
];
