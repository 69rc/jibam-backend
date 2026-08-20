import { v4 as uuidv4 } from 'uuid';
import { Order, Payment, PaymentLog, Notification, Product, OrderItem, User } from '../../../models/index.js';
import opayService from '../services/opay.service.js';
import { successResponse, errorResponse } from '../../../utils/apiResponse.js';
import { sendPharmacistPaymentAlert } from '../../../utils/email.js';
import { fulfillOrderItems } from '../../../utils/paymentFulfillment.js';

// ─── helper: log payment event ────────────────────────────────────────────────
async function logEvent(paymentId, event, req, responsePayload, status = 'success', errorMessage = null) {
  try {
    await PaymentLog.create({
      paymentId,
      event,
      requestPayload:  null,
      responsePayload: responsePayload || null,
      status,
      errorMessage,
      ipAddress: req?.ip,
      userAgent: req?.get('user-agent'),
    });
  } catch (e) {
    console.error('[PaymentLog] Failed to log:', e.message);
  }
}

// ─── helper: fulfill order after successful payment ────────────────────────────
async function fulfillOrder(orderId, transactionId, channel, paymentId, userId, reference) {
  const order = await Order.findByPk(orderId);
  if (!order) return;

  await order.update({
    status: 'paid',
    paymentStatus: 'paid',
    paidAt: new Date(),
  });

  // Now that payment is confirmed: deduct stock + remove purchased cart items
  await fulfillOrderItems(orderId, userId);

  // Create in-app notification
  Notification.create({
    userId,
    title: 'Payment Successful 🎉',
    message: `Your payment for order #${order.orderNumber} was successful.`,
    type: 'payment',
    data: { orderId: order.id, reference },
  }).catch(console.error);

  // Email pharmacist
  const customer = await User.findByPk(userId, { attributes: ['id', 'fullname', 'email', 'phone'] });
  sendPharmacistPaymentAlert(order, customer, channel).catch(console.error);

  return order;
}

// ─── POST /api/v1/payments/opay/initialize ─────────────────────────────────────
export const initializeOPayPayment = async (req, res, next) => {
  try {
    const { orderId } = req.body;
    const userId = req.user.id;

    const order = await Order.findOne({
      where: { id: orderId, userId },
      include: [{ model: OrderItem, as: 'items' }],
    });

    if (!order)                         return errorResponse(res, 'Order not found', 404);
    if (order.paymentStatus === 'paid') return errorResponse(res, 'Order already paid', 400);
    if (order.status === 'cancelled')   return errorResponse(res, 'Cannot pay for a cancelled order', 400);

    const reference = `OPAY-${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`;

    // Call OPay cashier API
    const result = await opayService.initializePayment({
      reference,
      amount:        parseFloat(order.total),
      currency:      'NGN',
      customerEmail: req.user.email,
      customerName:  req.user.fullname,
      customerPhone: req.user.phone || '',
      userId,
      items:         order.items || [],
      expireAt:      600,
    });

    // Save pending payment record
    const payment = await Payment.create({
      orderId:  order.id,
      userId,
      reference,
      amount:   parseFloat(order.total),
      currency: 'NGN',
      provider: 'opay',
      status:   'pending',
      metadata: result.raw,
    });

    await order.update({ paymentReference: reference });
    await logEvent(payment.id, 'initialization', req, result.raw, 'success');

    return successResponse(res, {
      paymentId:    payment.id,
      cashierUrl:   result.cashierUrl,   // redirect customer here
      reference,
      amount:       parseFloat(order.total),
      currency:     'NGN',
      expireAt:     result.expireAt,
    }, 'OPay payment initialized');

  } catch (error) {
    console.error('[OPay] initializePayment error:', error.message);
    next(error);
  }
};

// ─── GET /api/v1/payments/opay/verify/:reference ────────────────────────────────
export const verifyOPayPayment = async (req, res, next) => {
  try {
    const { reference } = req.params;

    const payment = await Payment.findOne({ where: { reference } });
    if (!payment) return errorResponse(res, 'Payment record not found', 404);

    if (payment.status === 'success') {
      return successResponse(res, { payment }, 'Payment already verified');
    }

    const result = await opayService.verifyPayment(reference);
    await logEvent(payment.id, 'verification', req, result.raw, result.success ? 'success' : 'failed');

    if (!result.success) {
      await payment.update({ status: result.status === 'fail' ? 'failed' : result.status, gatewayResponse: result.status });
      return errorResponse(res, `Payment ${result.status}`, 400);
    }

    await payment.update({
      status:          'success',
      transactionId:   result.transactionId,
      channel:         result.channel,
      gatewayResponse: 'Payment successful',
      paidAt:          result.paidAt,
      metadata:        result.raw,
    });

    const order = await fulfillOrder(payment.orderId, result.transactionId, result.channel, payment.id, payment.userId, reference);

    return successResponse(res, {
      payment,
      order: order ? { id: order.id, orderNumber: order.orderNumber, status: order.status } : null,
    }, 'Payment verified successfully');

  } catch (error) {
    console.error('[OPay] verifyPayment error:', error.message);
    next(error);
  }
};

// ─── POST /api/v1/payments/opay/webhook ────────────────────────────────────────
export const handleOPayWebhook = async (req, res, next) => {
  try {
    const payload   = req.body;
    const signature = req.headers['x-opay-signature'] || req.headers['signature'];

    if (!opayService.verifyWebhookSignature(payload, signature)) {
      return errorResponse(res, 'Invalid webhook signature', 401);
    }

    const reference = payload.reference || payload.orderNo;
    const status    = (payload.status || payload.orderStatus || '').toUpperCase();

    const payment = await Payment.findOne({ where: { reference } });
    if (!payment) return errorResponse(res, 'Payment not found', 404);

    if (payment.status === 'success' && status === 'SUCCESS') {
      return successResponse(res, { message: 'Already processed' });
    }

    await logEvent(payment.id, 'webhook', req, payload, 'success');

    if (status === 'SUCCESS') {
      await payment.update({
        status:          'success',
        transactionId:   payload.transId || payload.orderNo,
        channel:         payload.payChannel || 'opay',
        gatewayResponse: 'Webhook: payment successful',
        paidAt:          new Date(),
        metadata:        payload,
      });
      await fulfillOrder(payment.orderId, payload.transId, payload.payChannel, payment.id, payment.userId, reference);

    } else if (['FAIL', 'CANCEL'].includes(status)) {
      await payment.update({ status: 'failed', gatewayResponse: `Webhook: ${status}`, metadata: payload });
    }

    return successResponse(res, { message: 'Webhook processed' });

  } catch (error) {
    console.error('[OPay] webhook error:', error.message);
    next(error);
  }
};

// ─── GET /api/v1/payments/opay/callback ────────────────────────────────────────
// OPay redirects customer here after payment attempt
export const handleOPayCallback = async (req, res) => {
  const { reference, status } = req.query;
  const frontendBase = process.env.CUSTOMER_APP_URL || 'http://localhost:3002';

  if (!reference) {
    return res.redirect(`${frontendBase}/cart?error=missing_reference`);
  }

  try {
    const payment = await Payment.findOne({ where: { reference } });
    if (!payment) return res.redirect(`${frontendBase}/cart?error=payment_not_found`);

    if (payment.status === 'success') {
      return res.redirect(`${frontendBase}/order-success?reference=${reference}`);
    }

    if (status === 'Cancel' || status === 'Fail') {
      return res.redirect(`${frontendBase}/payment?error=payment_failed&reference=${reference}`);
    }

    // Auto-verify after redirect
    const result = await opayService.verifyPayment(reference);

    if (result.success) {
      await payment.update({
        status:          'success',
        transactionId:   result.transactionId,
        channel:         result.channel,
        gatewayResponse: 'Callback verified',
        paidAt:          result.paidAt,
        metadata:        result.raw,
      });
      await fulfillOrder(payment.orderId, result.transactionId, result.channel, payment.id, payment.userId, reference);
      return res.redirect(`${frontendBase}/order-success?reference=${reference}`);
    }

    return res.redirect(`${frontendBase}/payment?error=payment_failed&reference=${reference}`);

  } catch (err) {
    console.error('[OPay] callback error:', err.message);
    return res.redirect(`${frontendBase}/cart?error=callback_error`);
  }
};
