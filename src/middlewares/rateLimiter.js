import rateLimit from 'express-rate-limit';

// General API rate limiter
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiter for auth endpoints (prevent brute force)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Payment limiter
export const paymentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: {
    success: false,
    message: 'Too many payment requests. Please slow down.',
  },
});

// Upload limiter
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: 'Too many upload requests.',
  },
});

// Webhook limiter (more lenient for payment gateway webhooks)
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Allow more requests from payment gateways
  message: {
    success: false,
    message: 'Too many webhook requests.',
  },
  skip: (req) => {
    // Skip rate limiting if request is from known payment gateway IPs
    // You can add OPay's IP ranges here
    const trustedIPs = process.env.OPAY_WEBHOOK_IPS?.split(',') || [];
    return trustedIPs.includes(req.ip);
  },
});
