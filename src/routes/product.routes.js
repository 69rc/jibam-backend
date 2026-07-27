import { Router } from 'express';
import {
  getProducts, getProductById, getProductsByCategory,
  createProduct, updateProduct, deleteProduct, getHomeProducts,
} from '../controllers/product.controller.js';
import { getProductReviews, createReview } from '../controllers/review.controller.js';
import { protect, restrictTo, optionalAuth } from '../middlewares/auth.js';
import { validate, normalizeFormData } from '../middlewares/validate.js';
import { createProductValidator, updateProductValidator, createReviewValidator } from '../validators/product.validators.js';
import { uploadProductImages } from '../config/cloudinary.js';

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
router.post('/', protect, restrictTo('admin'), uploadFields, normalizeFormData, createProductValidator, validate, createProduct);
router.put('/:id', protect, restrictTo('admin'), uploadFields, normalizeFormData, updateProduct);
router.delete('/:id', protect, restrictTo('admin'), deleteProduct);

export default router;
