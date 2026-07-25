import { Router } from 'express';
import {
  initializeOPayPayment,
  verifyOPayPayment,
  handleOPayWebhook,
  handleOPayCallback,
} from '../controllers/opay.controller.js';
import { protect } from '../../../middlewares/auth.js';
import { paymentLimiter, webhookLimiter } from '../../../middlewares/rateLimiter.js';
import {
  verifyOPayWebhookSignature,
  preventDuplicateWebhook,
} from '../middleware/webhookSignature.middleware.js';

const router = Router();

// ─── Webhook & Callback Routes (no authentication required) ───────────────────
// These must come before the protect middleware
const publicRouter = Router();

// Handle OPay webhook (public endpoint for OPay server)
publicRouter.post(
  '/webhook',
  webhookLimiter,
  verifyOPayWebhookSignature,
  preventDuplicateWebhook,
  handleOPayWebhook
);

// Handle OPay callback (public endpoint for redirect)
publicRouter.get('/callback', handleOPayCallback);

// ─── Protected Routes (require authentication) ───────────────────────────────
router.use(protect);

// Initialize OPay payment
router.post(
  '/initialize',
  paymentLimiter,
  initializeOPayPayment
);

// Verify OPay payment
router.get(
  '/verify/:reference',
  verifyOPayPayment
);

// Combine public and protected routes
export default Router().use(publicRouter).use(router);
