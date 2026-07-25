import { Router } from 'express';
import { initializePayment, verifyPayment, getPaymentHistory } from '../controllers/payment.controller.js';
import { protect } from '../middlewares/auth.js';
import { paymentLimiter } from '../middlewares/rateLimiter.js';

const router = Router();
router.use(protect);
router.post('/initialize', paymentLimiter, initializePayment);
router.post('/verify', verifyPayment);
router.get('/history', getPaymentHistory);
export default router;
