import { Router } from 'express';
import {
  getCategories, getCategoryById,
  createCategory, updateCategory, deleteCategory,
} from '../controllers/category.controller.js';
import { protect, restrictTo } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { createCategoryValidator } from '../validators/product.validators.js';
import { uploadProductImages } from '../config/cloudinary.js';

const router = Router();

// Public
router.get('/', getCategories);
router.get('/:id', getCategoryById);

// Admin only
router.post('/', protect, restrictTo('admin'), uploadProductImages.single('image'), createCategoryValidator, validate, createCategory);
router.put('/:id', protect, restrictTo('admin'), uploadProductImages.single('image'), updateCategory);
router.delete('/:id', protect, restrictTo('admin'), deleteCategory);

export default router;
