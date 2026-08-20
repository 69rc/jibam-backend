/**
 * Paystack Webhook Handler
 *
 * Paystack sends a POST to /api/v1/payments/webhook whenever a transaction
 * event occurs (charge.success, charge.failed, etc.).
 *
 * Security: we validate the X-Paystack-Signature header using HMAC-SHA512
 * with our PAYSTACK_SECRET_KEY. Any request that fails this check is rejected.
 *
 * Docs: https://paystack.com/docs/payments/webhooks/
 */
import crypto from 'crypto';
import { Order, Payment, Notification, User, OrderItem } from '../models/index.js';
import { sendOrderConfirmationEmail, sendPharmacistPaymentAlert } from '../utils/email.js';
import { sendWhatsAppNotification } from '../utils/whatsapp.js';
import { fulfillOrderItems } from '../utils/paymentFulfillment.js';

// ── Signature verification ───────────────────────────────────────────────────
const verifySignature = (rawBody, signature) => {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    console.error('[Webhook] PAYSTACK_SECRET_KEY not set — cannot verify signature');
    return false;
  }
  const hash = crypto
    .createHmac('sha512', secret)
    .update(rawBody)
    .digest('hex');
  return hash === signature;
};

// ── Process a confirmed charge.success event ─────────────────────────────────
const handleChargeSuccess = async (data) => {
  const reference = data.reference;
  console.log(`[Webhook] charge.success — ref: ${reference}`);

  // Find existing payment record
  const payment = await Payment.findOne({ where: { reference } });
  if (!payment) {
    console.warn(`[Webhook] No payment record for ref ${reference} — ignoring`);
    return;
  }

  // Already processed — idempotent
  if (payment.status === 'success') {
    console.log(`[Webhook] Payment ${reference} already marked success — skipping`);
    return;
  }

  // Update payment
  await payment.update({
    status: 'success',
    channel: data.channel,
    gatewayResponse: data.gateway_response,
    paidAt: data.paid_at ? new Date(data.paid_at) : new Date(),
    metadata: data,
  });

  // Update order
  const order = await Order.findByPk(payment.orderId);
  if (!order) {
    console.error(`[Webhook] Order ${payment.orderId} not found`);
    return;
  }

  await order.update({
    status: 'paid',
    paymentStatus: 'paid',
    paidAt: data.paid_at ? new Date(data.paid_at) : new Date(),
  });

  // Now that payment is confirmed: deduct stock + remove purchased cart items
  await fulfillOrderItems(order.id, payment.userId);

  console.log(`[Webhook] ✅ Order ${order.orderNumber} marked as PAID`);

  // Fetch customer
  const customer = await User.findByPk(payment.userId, {
    attributes: ['id', 'fullname', 'email', 'phone'],
  });

  // Fetch order with items
  const orderWithItems = await Order.findByPk(order.id, {
    include: [{ model: OrderItem, as: 'items' }],
  });

  // In-app notification
  Notification.create({
    userId: payment.userId,
    title: 'Payment Successful',
    message: `Payment of ₦${Number(payment.amount).toLocaleString()} for order #${order.orderNumber} was successful.`,
    type: 'payment',
    data: { orderId: order.id, reference },
  }).catch(console.error);

  // WhatsApp alert to pharmacist
  const msg =
    `✅ *PAYMENT CONFIRMED — Jibam Pharmacy*\n\n` +
    `📦 Order #${order.orderNumber}\n` +
    `👤 ${customer?.fullname || 'Customer'}\n` +
    `📞 ${order.deliveryPhone || customer?.phone || 'N/A'}\n` +
    `💰 *₦${Number(order.total).toLocaleString()} PAID*\n` +
    `🏦 Channel: ${data.channel || 'Paystack'}\n` +
    `📍 ${order.deliveryAddress || 'N/A'}\n\n` +
    `_Order is now ready to process._`;
  sendWhatsAppNotification(process.env.PHARMACIST_WHATSAPP, msg).catch(console.error);

  // Email to customer
  if (customer) sendOrderConfirmationEmail(customer, orderWithItems).catch(console.error);

  // Email to pharmacist
  sendPharmacistPaymentAlert(order, customer, data.channel).catch(console.error);
};

// ── Main webhook handler ──────────────────────────────────────────────────────
export const handlePaystackWebhook = async (req, res) => {
  const signature = req.headers['x-paystack-signature'];

  // Reject if no signature
  if (!signature) {
    console.warn('[Webhook] Missing X-Paystack-Signature header');
    return res.status(400).json({ message: 'Missing signature' });
  }

  // Validate signature using raw body
  const rawBody = req.rawBody; // set by middleware below
  if (!verifySignature(rawBody, signature)) {
    console.warn('[Webhook] Invalid signature — possible spoofed request');
    return res.status(401).json({ message: 'Invalid signature' });
  }

  const event = req.body;
  console.log(`[Webhook] Event received: ${event.event}`);

  // Always respond 200 quickly — Paystack retries if we don't
  res.status(200).json({ received: true });

  // Process asynchronously so we don't timeout
  try {
    if (event.event === 'charge.success') {
      await handleChargeSuccess(event.data);
    }
    // Future: handle refund.processed, subscription events, etc.
  } catch (err) {
    console.error('[Webhook] Processing error:', err.message);
  }
};
