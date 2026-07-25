import { v4 as uuidv4 } from 'uuid';
import { Order, Payment, Notification } from '../models/index.js';
import { initializeTransaction, verifyTransaction } from '../services/paystack.service.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { sendOrderConfirmationEmail } from '../utils/email.js';

// POST /payments/initialize
export const initializePayment = async (req, res, next) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findOne({
      where: { id: orderId, userId: req.user.id },
    });

    if (!order) return errorResponse(res, 'Order not found', 404);

    if (order.paymentStatus === 'paid') {
      return errorResponse(res, 'Order already paid', 400);
    }

    if (order.status === 'cancelled') {
      return errorResponse(res, 'Cannot pay for a cancelled order', 400);
    }

    const reference = `JIB-${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`;

    const paystackResponse = await initializeTransaction({
      email: req.user.email,
      amount: parseFloat(order.total),
      reference,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        userId: req.user.id,
        customerName: req.user.fullname,
      },
    });

    if (!paystackResponse.status) {
      return errorResponse(res, 'Payment initialization failed', 500);
    }

    // Store pending payment
    await Payment.create({
      orderId: order.id,
      userId: req.user.id,
      reference,
      amount: parseFloat(order.total),
      status: 'pending',
    });

    // Store reference on order
    await order.update({ paymentReference: reference });

    return successResponse(res, {
      authorizationUrl: paystackResponse.data.authorization_url,
      accessCode: paystackResponse.data.access_code,
      reference,
      amount: parseFloat(order.total),
    }, 'Payment initialized');
  } catch (error) {
    next(error);
  }
};

// POST /payments/verify
export const verifyPayment = async (req, res, next) => {
  try {
    const { reference } = req.body;

    if (!reference) return errorResponse(res, 'Payment reference is required', 400);

    const payment = await Payment.findOne({ where: { reference } });
    if (!payment) return errorResponse(res, 'Payment record not found', 404);

    if (payment.status === 'success') {
      return successResponse(res, payment, 'Payment already verified');
    }

    // Verify with Paystack
    const paystackResponse = await verifyTransaction(reference);

    if (!paystackResponse.status || paystackResponse.data.status !== 'success') {
      await payment.update({
        status: 'failed',
        gatewayResponse: paystackResponse.data?.gateway_response || 'Payment failed',
      });
      return errorResponse(res, 'Payment verification failed', 400);
    }

    // Update payment record
    await payment.update({
      status: 'success',
      channel: paystackResponse.data.channel,
      gatewayResponse: paystackResponse.data.gateway_response,
      paidAt: new Date(paystackResponse.data.paid_at),
      metadata: paystackResponse.data,
    });

    // Update order
    const order = await Order.findByPk(payment.orderId);
    await order.update({
      status: 'paid',
      paymentStatus: 'paid',
      paidAt: new Date(paystackResponse.data.paid_at),
    });

    // Create notification
    Notification.create({
      userId: payment.userId,
      title: 'Payment Successful',
      message: `Payment of ₦${Number(payment.amount).toLocaleString()} for order #${order.orderNumber} was successful.`,
      type: 'payment',
      data: { orderId: order.id, reference },
    }).catch(console.error);

    return successResponse(res, {
      payment,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        total: order.total,
      },
    }, 'Payment verified successfully');
  } catch (error) {
    // Handle Paystack 400/404 errors
    if (error.response?.status === 400) {
      return errorResponse(res, 'Invalid payment reference', 400);
    }
    next(error);
  }
};

// GET /payments/history — customer payment history
export const getPaymentHistory = async (req, res, next) => {
  try {
    const payments = await Payment.findAll({
      where: { userId: req.user.id },
      include: [
        {
          model: Order,
          as: 'order',
          attributes: ['id', 'orderNumber', 'status', 'total'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });
    return successResponse(res, payments);
  } catch (error) {
    next(error);
  }
};
