import { Router } from 'express';
import {
  createOrder, getMyOrders, getOrderById,
  updateOrderStatus, getAllOrders,
} from '../controllers/order.controller.js';
import { protect, restrictTo } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { createOrderValidator } from '../validators/product.validators.js';
import { uploadPrescription } from '../config/cloudinary.js';

const router = Router();
router.use(protect);
router.post('/', uploadPrescription.single('prescription'), createOrderValidator, validate, createOrder);
router.get('/my-orders', getMyOrders);
router.get('/:id', getOrderById);
router.get('/', restrictTo('admin'), getAllOrders);
router.put('/:id/status', restrictTo('admin'), updateOrderStatus);
export default router;
