import { v4 as uuidv4 } from 'uuid';
import { Order, Payment, PaymentLog, Notification, Product, OrderItem } from '../../../models/index.js';
import opayService from '../services/opay.service.js';
import { successResponse, errorResponse } from '../../../utils/apiResponse.js';

/**
 * Helper function to log payment events
 */
async function logPaymentEvent(paymentId, event, requestPayload, responsePayload, status = 'success', errorMessage = null, ipAddress = null, userAgent = null) {
  try {
    await PaymentLog.create({
      paymentId,
      event,
      requestPayload,
      responsePayload,
      status,
      errorMessage,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    console.error('Failed to log payment event:', error.message);
  }
}

/**
 * Initialize OPay payment
 * POST /api/v1/payments/opay/initialize
 */
export const initializeOPayPayment = async (req, res, next) => {
  try {
    const { orderId } = req.body;
    const userId = req.user.id;

    // Validate order
    const order = await Order.findOne({
      where: { id: orderId, userId },
      include: [
        {
          model: OrderItem,
          as: 'items',
          include: [{ model: Product, as: 'product' }],
        },
      ],
    });

    if (!order) {
      return errorResponse(res, 'Order not found', 404);
    }

    if (order.paymentStatus === 'paid') {
      return errorResponse(res, 'Order already paid', 400);
    }

    if (order.status === 'cancelled') {
      return errorResponse(res, 'Cannot pay for a cancelled order', 400);
    }

    // Generate unique reference
    const reference = `OPAY-${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`;

    // Prepare payment data
    const paymentData = {
      reference,
      amount: parseFloat(order.total),
      currency: 'NGN',
      customerEmail: req.user.email,
      customerName: req.user.fullname,
      customerPhone: req.user.phone || '',
      orderId: order.id,
      userId,
    };

    // Log initialization attempt
    await logPaymentEvent(
      null,
      'initialization',
      paymentData,
      null,
      'pending',
      null,
      req.ip,
      req.get('user-agent')
    );

    // Initialize payment with OPay
    const opayResponse = await opayService.initializePayment(paymentData);

    if (!opayResponse.success) {
      return errorResponse(res, opayResponse.message || 'Payment initialization failed', 500);
    }

    // Create payment record
    const payment = await Payment.create({
      orderId: order.id,
      userId,
      reference,
      amount: parseFloat(order.total),
      currency: 'NGN',
      provider: 'opay',
      status: 'pending',
      metadata: opayResponse.data,
    });

    // Log successful initialization
    await logPaymentEvent(
      payment.id,
      'initialization',
      paymentData,
      opayResponse.data,
      'success',
      null,
      req.ip,
      req.get('user-agent')
    );

    // Update order with payment reference
    await order.update({ paymentReference: reference });

    return successResponse(
      res,
      {
        paymentId: payment.id,
        authorizationUrl: opayResponse.data.paymentUrl || opayResponse.data.checkoutUrl,
        reference,
        amount: parseFloat(order.total),
        currency: 'NGN',
        expireAt: opayResponse.data.expireAt,
      },
      'OPay payment initialized successfully'
    );
  } catch (error) {
    console.error('OPay initialization error:', error);
    next(error);
  }
};

/**
 * Verify OPay payment
 * GET /api/v1/payments/opay/verify/:reference
 */
export const verifyOPayPayment = async (req, res, next) => {
  try {
    const { reference } = req.params;

    // Find payment record
    const payment = await Payment.findOne({ where: { reference } });
    if (!payment) {
      return errorResponse(res, 'Payment record not found', 404);
    }

    // If already verified, return existing data
    if (payment.status === 'success') {
      return successResponse(res, payment, 'Payment already verified');
    }

    // Log verification attempt
    await logPaymentEvent(
      payment.id,
      'verification',
      { reference },
      null,
      'pending',
      null,
      req.ip,
      req.get('user-agent')
    );

    // Verify with OPay
    const opayResponse = await opayService.verifyPayment(reference);

    // Log verification response
    await logPaymentEvent(
      payment.id,
      'verification',
      { reference },
      opayResponse.data,
      opayResponse.success ? 'success' : 'failed',
      opayResponse.success ? null : opayResponse.message,
      req.ip,
      req.get('user-agent')
    );

    if (!opayResponse.success || opayResponse.data.status !== 'success') {
      // Update payment as failed
      await payment.update({
        status: 'failed',
        gatewayResponse: opayResponse.message || 'Payment verification failed',
      });

      return errorResponse(res, 'Payment verification failed', 400);
    }

    // Update payment record
    await payment.update({
      status: 'success',
      transactionId: opayResponse.data.transactionId,
      channel: opayResponse.data.channel || 'opay',
      gatewayResponse: opayResponse.message || 'Payment successful',
      paidAt: new Date(),
      metadata: opayResponse.data,
    });

    // Update order
    const order = await Order.findByPk(payment.orderId);
    if (order) {
      await order.update({
        status: 'paid',
        paymentStatus: 'paid',
        paidAt: new Date(),
      });

      // Reduce product stock
      const orderItems = await OrderItem.findAll({ where: { orderId: order.id } });
      for (const item of orderItems) {
        const product = await Product.findByPk(item.productId);
        if (product) {
          await product.update({
            stock: Math.max(0, product.stock - item.quantity),
          });
        }
      }

      // Create notification
      await Notification.create({
        userId: payment.userId,
        title: 'Payment Successful',
        message: `Payment of ₦${Number(payment.amount).toLocaleString()} for order #${order.orderNumber} was successful.`,
        type: 'payment',
        data: { orderId: order.id, reference },
      }).catch(console.error);
    }

    return successResponse(
      res,
      {
        payment,
        order: order ? {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          paymentStatus: order.paymentStatus,
          total: order.total,
        } : null,
      },
      'Payment verified successfully'
    );
  } catch (error) {
    console.error('OPay verification error:', error);
    next(error);
  }
};

/**
 * Handle OPay webhook
 * POST /api/v1/payments/opay/webhook
 */
export const handleOPayWebhook = async (req, res, next) => {
  try {
    const payload = req.body;
    const signature = req.headers['x-opay-signature'] || req.headers['signature'];

    // Verify webhook signature
    if (!opayService.verifyWebhookSignature(payload, signature)) {
      return errorResponse(res, 'Invalid webhook signature', 401);
    }

    const { reference, status, amount, transactionId } = payload;

    // Find payment record
    const payment = await Payment.findOne({ where: { reference } });
    if (!payment) {
      return errorResponse(res, 'Payment record not found', 404);
    }

    // Prevent duplicate processing
    if (payment.status === 'success' && status === 'success') {
      return successResponse(res, { message: 'Webhook already processed' });
    }

    // Log webhook event
    await logPaymentEvent(
      payment.id,
      'webhook',
      payload,
      null,
      'success',
      null,
      req.ip,
      req.get('user-agent')
    );

    // Update payment based on webhook status
    if (status === 'success') {
      await payment.update({
        status: 'success',
        transactionId,
        gatewayResponse: 'Payment successful via webhook',
        paidAt: new Date(),
        metadata: payload,
      });

      // Update order
      const order = await Order.findByPk(payment.orderId);
      if (order) {
        await order.update({
          status: 'paid',
          paymentStatus: 'paid',
          paidAt: new Date(),
        });

        // Reduce product stock
        const orderItems = await OrderItem.findAll({ where: { orderId: order.id } });
        for (const item of orderItems) {
          const product = await Product.findByPk(item.productId);
          if (product) {
            await product.update({
              stock: Math.max(0, product.stock - item.quantity),
            });
          }
        }

        // Create notification
        await Notification.create({
          userId: payment.userId,
          title: 'Payment Successful',
          message: `Payment of ₦${Number(payment.amount).toLocaleString()} for order #${order.orderNumber} was successful.`,
          type: 'payment',
          data: { orderId: order.id, reference },
        }).catch(console.error);
      }
    } else if (status === 'failed' || status === 'cancelled') {
      await payment.update({
        status: 'failed',
        gatewayResponse: `Payment ${status} via webhook`,
        metadata: payload,
      });
    }

    return successResponse(res, { message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('OPay webhook error:', error);
    next(error);
  }
};

/**
 * Handle OPay callback
 * GET /api/v1/payments/opay/callback
 */
export const handleOPayCallback = async (req, res, next) => {
  try {
    const { reference, status } = req.query;

    if (!reference) {
      return res.redirect(`${process.env.CUSTOMER_APP_URL}/checkout?error=missing_reference`);
    }

    // Verify payment
    const payment = await Payment.findOne({ where: { reference } });
    if (!payment) {
      return res.redirect(`${process.env.CUSTOMER_APP_URL}/checkout?error=payment_not_found`);
    }

    // Log callback event
    await logPaymentEvent(
      payment.id,
      'callback',
      req.query,
      null,
      'success',
      null,
      req.ip,
      req.get('user-agent')
    );

    // If payment is already successful, redirect to success page
    if (payment.status === 'success') {
      return res.redirect(`${process.env.CUSTOMER_APP_URL}/order-success?reference=${reference}`);
    }

    // If payment failed or cancelled, redirect to failure page
    if (status === 'cancelled' || payment.status === 'failed') {
      return res.redirect(`${process.env.CUSTOMER_APP_URL}/checkout?error=payment_failed&reference=${reference}`);
    }

    // Otherwise, verify with OPay
    try {
      const opayResponse = await opayService.verifyPayment(reference);

      if (opayResponse.success && opayResponse.data.status === 'success') {
        // Update payment
        await payment.update({
          status: 'success',
          transactionId: opayResponse.data.transactionId,
          channel: opayResponse.data.channel || 'opay',
          gatewayResponse: opayResponse.message || 'Payment successful',
          paidAt: new Date(),
          metadata: opayResponse.data,
        });

        // Update order
        const order = await Order.findByPk(payment.orderId);
        if (order) {
          await order.update({
            status: 'paid',
            paymentStatus: 'paid',
            paidAt: new Date(),
          });

          // Reduce product stock
          const orderItems = await OrderItem.findAll({ where: { orderId: order.id } });
          for (const item of orderItems) {
            const product = await Product.findByPk(item.productId);
            if (product) {
              await product.update({
                stock: Math.max(0, product.stock - item.quantity),
              });
            }
          }
        }

        return res.redirect(`${process.env.CUSTOMER_APP_URL}/order-success?reference=${reference}`);
      } else {
        await payment.update({
          status: 'failed',
          gatewayResponse: opayResponse.message || 'Payment verification failed',
        });
        return res.redirect(`${process.env.CUSTOMER_APP_URL}/checkout?error=payment_failed&reference=${reference}`);
      }
    } catch (error) {
      console.error('Callback verification error:', error);
      return res.redirect(`${process.env.CUSTOMER_APP_URL}/checkout?error=verification_failed&reference=${reference}`);
    }
  } catch (error) {
    console.error('OPay callback error:', error);
    return res.redirect(`${process.env.CUSTOMER_APP_URL}/checkout?error=callback_error`);
  }
};
