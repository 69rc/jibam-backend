import { Router } from 'express';
import { initializePayment, verifyPayment, getPaymentHistory } from '../controllers/payment.controller.js';
import { handlePaystackWebhook } from '../controllers/webhook.controller.js';
import { protect } from '../middlewares/auth.js';
import { paymentLimiter } from '../middlewares/rateLimiter.js';
import express from 'express';

const router = Router();

// ── Paystack Webhook — NO auth, raw body required for signature verification ──
// Must be registered BEFORE express.json() middleware processes the body.
// We capture the raw body here and attach it to req.rawBody.
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  (req, res, next) => {
    // Store raw body as string for HMAC verification
    req.rawBody = req.body.toString('utf8');
    // Parse body so handler can read req.body.event etc.
    try { req.body = JSON.parse(req.rawBody); } catch { req.body = {}; }
    next();
  },
  handlePaystackWebhook
);

// ── Authenticated payment routes ───────────────────────────────────────────
router.use(protect);
router.post('/initialize', paymentLimiter, initializePayment);
router.post('/verify', verifyPayment);
router.get('/history', getPaymentHistory);

export default router;
