import { Router } from 'express';
import { initializePayment, verifyPayment, getPaymentHistory } from '../controllers/payment.controller.js';
import { handlePaystackWebhook } from '../controllers/webhook.controller.js';
import { protect } from '../middlewares/auth.js';
import { paymentLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

// ── Paystack Webhook — NO auth, raw body required for signature verification ──
// The raw body is captured at the app level (see server.js) BEFORE express.json
// parses it, and attached to req.rawBody. This route just handles the event.
router.post('/webhook', handlePaystackWebhook);

// ── Authenticated payment routes ───────────────────────────────────────────
router.use(protect);
router.post('/initialize', paymentLimiter, initializePayment);
router.post('/verify', verifyPayment);
router.get('/history', getPaymentHistory);

export default router;
