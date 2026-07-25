import { body, param } from 'express-validator';

/**
 * Validation rules for OPay payment initialization
 */
export const initializeOPayPaymentValidator = [
  body('orderId')
    .notEmpty()
    .withMessage('Order ID is required')
    .isUUID()
    .withMessage('Invalid order ID format'),
  body('amount')
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('Amount must be greater than 0'),
  body('currency')
    .optional()
    .isIn(['NGN', 'USD'])
    .withMessage('Currency must be NGN or USD'),
];

/**
 * Validation rules for OPay payment verification
 */
export const verifyOPayPaymentValidator = [
  param('reference')
    .notEmpty()
    .withMessage('Payment reference is required')
    .isString()
    .withMessage('Invalid reference format'),
];

/**
 * Validation rules for OPay webhook
 */
export const opayWebhookValidator = [
  body('reference')
    .notEmpty()
    .withMessage('Reference is required'),
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['success', 'failed', 'pending', 'cancelled'])
    .withMessage('Invalid status value'),
  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isFloat({ gt: 0 })
    .withMessage('Amount must be greater than 0'),
  body('transactionId')
    .optional()
    .isString()
    .withMessage('Invalid transaction ID format'),
];
