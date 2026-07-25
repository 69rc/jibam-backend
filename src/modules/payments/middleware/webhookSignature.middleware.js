import crypto from 'crypto';
import { errorResponse } from '../../../utils/apiResponse.js';

/**
 * Middleware to verify OPay webhook signature
 * This ensures that webhook requests are genuinely from OPay
 */
export const verifyOPayWebhookSignature = (req, res, next) => {
  try {
    const signature = req.headers['x-opay-signature'] || req.headers['signature'];
    const webhookSecret = process.env.OPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('OPAY_WEBHOOK_SECRET not configured');
      return errorResponse(res, 'Webhook secret not configured', 500);
    }

    if (!signature) {
      return errorResponse(res, 'Missing signature header', 401);
    }

    // Generate expected signature
    const payload = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHash('sha512')
      .update(payload + webhookSecret)
      .digest('hex');

    // Compare signatures
    if (signature !== expectedSignature) {
      console.error('Webhook signature mismatch:', {
        received: signature,
        expected: expectedSignature,
      });
      return errorResponse(res, 'Invalid signature', 401);
    }

    // Signature is valid, proceed to next middleware
    next();
  } catch (error) {
    console.error('Webhook signature verification error:', error);
    return errorResponse(res, 'Signature verification failed', 500);
  }
};

/**
 * Middleware to prevent duplicate webhook processing
 * Uses idempotency key to ensure same webhook isn't processed twice
 */
export const preventDuplicateWebhook = async (req, res, next) => {
  try {
    const { reference, transactionId } = req.body;
    const idempotencyKey = req.headers['x-opay-idempotency-key'] || `${reference}_${transactionId}`;

    // Store processed webhooks in Redis or database
    // For now, we'll use a simple in-memory approach (not recommended for production)
    // In production, use Redis with TTL
    const processedWebhooks = global.processedWebhooks || new Set();

    if (processedWebhooks.has(idempotencyKey)) {
      return errorResponse(res, 'Webhook already processed', 200);
    }

    // Mark as processed
    processedWebhooks.add(idempotencyKey);
    global.processedWebhooks = processedWebhooks;

    // Clean up old entries (optional)
    if (processedWebhooks.size > 10000) {
      const entries = Array.from(processedWebhooks);
      processedWebhooks.clear();
      entries.slice(-5000).forEach((entry) => processedWebhooks.add(entry));
    }

    next();
  } catch (error) {
    console.error('Duplicate webhook prevention error:', error);
    next(); // Continue even if duplicate check fails
  }
};
