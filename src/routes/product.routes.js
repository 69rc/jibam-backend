import { Router } from 'express';
import multer from 'multer';
import {
  getProducts, getProductById, getProductsByCategory,
  createProduct, updateProduct, deleteProduct, getHomeProducts,
} from '../controllers/product.controller.js';
import { getProductReviews, createReview } from '../controllers/review.controller.js';
import { protect, restrictTo, optionalAuth } from '../middlewares/auth.js';
import { validate, normalizeFormData } from '../middlewares/validate.js';
import { createProductValidator, updateProductValidator, createReviewValidator } from '../validators/product.validators.js';
import { uploadProductImages } from '../config/cloudinary.js';

// Multer error handler middleware
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error('Multer error:', err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        message: 'File size too large. Maximum size is 5MB.',
        timestamp: new Date().toISOString(),
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files uploaded. Maximum is 5 files.',
        timestamp: new Date().toISOString(),
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected file field',
        timestamp: new Date().toISOString(),
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message || 'File upload error',
      timestamp: new Date().toISOString(),
    });
  }
  next(err);
};

const router = Router();

// Public routes - no auth needed
router.get('/home', getHomeProducts);
router.get('/', getProducts);
router.get('/category/:categoryId', getProductsByCategory);
router.get('/:id', optionalAuth, getProductById);
router.get('/:productId/reviews', getProductReviews);

// Customer - login required
router.post('/:productId/reviews', protect, createReviewValidator, validate, createReview);

// Admin only
const uploadFields = uploadProductImages.fields([
  { name: 'image', maxCount: 1 },
  { name: 'images', maxCount: 4 },
]);
router.post('/', protect, restrictTo('admin'), uploadFields, handleMulterError, normalizeFormData, createProductValidator, validate, createProduct);
router.put('/:id', protect, restrictTo('admin'), uploadFields, handleMulterError, normalizeFormData, updateProduct);
router.delete('/:id', protect, restrictTo('admin'), deleteProduct);

export default router;
