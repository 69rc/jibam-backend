import sequelize from '../config/database.js';
import { Order, OrderItem, Cart, CartItem, Product, Payment, Notification, User } from '../models/index.js';
import {
  successResponse,
  errorResponse,
  paginatedResponse,
  getPagination,
  getPaginationMeta,
} from '../utils/apiResponse.js';
import { sendOrderConfirmationEmail, sendPharmacistOrderAlert } from '../utils/email.js';
import { notifyPharmacistNewOrder } from '../utils/whatsapp.js';
import { sendTelegramMessage, formatOrderAlert } from '../utils/telegram.js';

import StoreSettings from '../models/StoreSettings.js';

const DEFAULT_DELIVERY_FEE = 500;

// Fetch delivery fee from DB zones based on city (zone label)
const getDeliveryFeeForCity = async (city = '') => {
  try {
    const setting = await StoreSettings.findOne({ where: { key: 'delivery_zones' } });
    if (!setting) return DEFAULT_DELIVERY_FEE;
    const zones = JSON.parse(setting.value);
    const c = city.trim().toLowerCase();
    const match = zones.find((z) =>
      z.label.toLowerCase() === c ||
      (z.areas || []).some((a) => c.includes(a) || a.includes(c))
    );
    return match ? Number(match.fee) : DEFAULT_DELIVERY_FEE;
  } catch {
    return DEFAULT_DELIVERY_FEE;
  }
};

// POST /orders — create order from cart
export const createOrder = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const {
      deliveryAddress,
      deliveryPhone,
      deliveryInstructions,
      deliveryCity,   // zone label sent from frontend e.g. "Central Kano"
      promoCode,
    } = req.body;

    // Fetch user's cart
    const cart = await Cart.findOne({
      where: { userId: req.user.id },
      include: [
        {
          model: CartItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              where: { isActive: true },
            },
          ],
        },
      ],
    });

    if (!cart || !cart.items || cart.items.length === 0) {
      await t.rollback();
      return errorResponse(res, 'Your cart is empty', 400);
    }

    // Validate stock and compute subtotal
    let subtotal = 0;
    for (const item of cart.items) {
      if (item.product.stock < item.quantity) {
        await t.rollback();
        return errorResponse(
          res,
          `Insufficient stock for "${item.product.name}". Available: ${item.product.stock}`,
          400
        );
      }
      subtotal += parseFloat(item.product.price) * item.quantity;
    }

    const deliveryFee = await getDeliveryFeeForCity(deliveryCity || '');
    let discount = 0;

    // Generate order number in controller (most reliable approach)
    const ts = Date.now().toString().slice(-6);
    const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const orderNumber = `JIB${ts}${rand}`;

    // Promo code validation
    if (promoCode) {
      const { PromoCode } = await import('../models/index.js');
      const promo = await PromoCode.findOne({
        where: { code: promoCode.toUpperCase(), isActive: true },
      });

      if (!promo) {
        await t.rollback();
        return errorResponse(res, 'Invalid promo code', 400);
      }
      if (promo.expiresAt && promo.expiresAt < new Date()) {
        await t.rollback();
        return errorResponse(res, 'Promo code has expired', 400);
      }
      if (promo.usageLimit && promo.usageCount >= promo.usageLimit) {
        await t.rollback();
        return errorResponse(res, 'Promo code usage limit reached', 400);
      }
      if (subtotal < promo.minimumOrder) {
        await t.rollback();
        return errorResponse(
          res,
          `Minimum order of ₦${promo.minimumOrder} required for this promo`,
          400
        );
      }

      if (promo.discountType === 'percentage') {
        discount = (subtotal * promo.discountValue) / 100;
        if (promo.maxDiscount) discount = Math.min(discount, promo.maxDiscount);
      } else {
        discount = promo.discountValue;
      }

      await promo.increment('usageCount', { transaction: t });
    }

    const total = subtotal + deliveryFee - discount;

    // Create order
    const order = await Order.create(
      {
        orderNumber,
        userId: req.user.id,
        subtotal: parseFloat(subtotal.toFixed(2)),
        deliveryFee,
        discount: parseFloat(discount.toFixed(2)),
        total: parseFloat(total.toFixed(2)),
        deliveryAddress,
        deliveryPhone,
        deliveryInstructions,
        promoCode: promoCode || null,
        status: 'pending',
        paymentStatus: 'unpaid',
      },
      { transaction: t }
    );

    // Create order items & deduct stock
    const orderItems = cart.items.map((item) => ({
      orderId: order.id,
      productId: item.productId,
      productName: item.product.name,
      productImage: item.product.image,
      quantity: item.quantity,
      price: parseFloat(item.product.price),
      total: parseFloat((parseFloat(item.product.price) * item.quantity).toFixed(2)),
    }));

    await OrderItem.bulkCreate(orderItems, { transaction: t });

    // NOTE: We intentionally do NOT deduct stock or clear the cart here.
    // Stock is only reserved/deducted AFTER the customer pays (see
    // payment/webhook/verify fulfillment), so unpaid orders never reduce
    // inventory and the cart stays intact until payment is confirmed.

    await t.commit();

    // Fetch full order with items (needed for notifications)
    const fullOrder = await Order.findByPk(order.id, {
      include: [{ model: OrderItem, as: 'items' }],
    });

    // Create in-app notification (non-blocking)
    Notification.create({
      userId: req.user.id,
      title: 'Order Placed',
      message: `Your order #${order.orderNumber} has been placed successfully.`,
      type: 'order',
      data: { orderId: order.id, orderNumber: order.orderNumber },
    }).catch(console.error);

    // Send confirmation email to customer (non-blocking)
    sendOrderConfirmationEmail(req.user, fullOrder).catch(console.error);

    // Send new order alert to pharmacist email (non-blocking, no third-party)
    sendPharmacistOrderAlert(fullOrder, req.user).catch(console.error);

    // Send WhatsApp notification to pharmacist (non-blocking, optional)
    notifyPharmacistNewOrder(fullOrder, req.user).catch(console.error);

    // Send Telegram notification to pharmacist (free, instant)
    sendTelegramMessage(formatOrderAlert(fullOrder, req.user)).catch(console.error);

    return successResponse(res, fullOrder, 'Order created successfully', 201);
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

// GET /orders — customer order history
export const getMyOrders = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { status } = req.query;

    const where = { userId: req.user.id };
    if (status) where.status = status;

    const { count, rows } = await Order.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: OrderItem,
          as: 'items',
          attributes: ['id', 'productName', 'productImage', 'quantity', 'price', 'total'],
        },
      ],
    });

    return paginatedResponse(res, rows, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

// GET /orders/:id
export const getOrderById = async (req, res, next) => {
  try {
    const where = { id: req.params.id };
    // Customers can only see their own orders
    if (req.user.role !== 'admin') where.userId = req.user.id;

    const order = await Order.findOne({
      where,
      include: [
        { model: OrderItem, as: 'items' },
        { model: Payment, as: 'payment' },
        { model: User, as: 'user', attributes: ['id', 'fullname', 'email', 'phone'] },
      ],
    });

    if (!order) return errorResponse(res, 'Order not found', 404);

    return successResponse(res, order);
  } catch (error) {
    next(error);
  }
};

// PUT /orders/:id/status (admin)
export const updateOrderStatus = async (req, res, next) => {
  try {
    const { status, cancelReason } = req.body;

    const validStatuses = ['pending', 'paid', 'processing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return errorResponse(res, 'Invalid order status', 400);
    }

    const order = await Order.findByPk(req.params.id, {
      include: [{ model: User, as: 'user' }],
    });
    if (!order) return errorResponse(res, 'Order not found', 404);

    const updateData = { status };
    if (status === 'cancelled' && cancelReason) updateData.cancelReason = cancelReason;

    await order.update(updateData);

    // Notify customer
    if (order.userId) {
      const messages = {
        processing: 'Your order is being processed.',
        ready: 'Your order is ready for pickup/delivery.',
        out_for_delivery: 'Your order is out for delivery!',
        delivered: 'Your order has been delivered. Enjoy!',
        cancelled: `Your order has been cancelled. ${cancelReason || ''}`,
      };

      if (messages[status]) {
        Notification.create({
          userId: order.userId,
          title: `Order ${status.replace(/_/g, ' ').toUpperCase()}`,
          message: messages[status],
          type: 'order',
          data: { orderId: order.id, orderNumber: order.orderNumber },
        }).catch(console.error);
      }
    }

    return successResponse(res, order, 'Order status updated');
  } catch (error) {
    next(error);
  }
};

// GET /admin/orders — all orders (admin)
export const getAllOrders = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { status, paymentStatus, search } = req.query;

    const where = {};
    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;

    const includeUser = {
      model: User,
      as: 'user',
      attributes: ['id', 'fullname', 'email', 'phone'],
      required: false,
    };

    if (search) {
      const { Op } = await import('sequelize');
      includeUser.where = {
        [Op.or]: [
          { fullname: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } },
        ],
      };
      includeUser.required = true;
    }

    const { count, rows } = await Order.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        includeUser,
        {
          model: OrderItem,
          as: 'items',
          attributes: ['id', 'productName', 'quantity', 'price', 'total'],
        },
      ],
    });

    return paginatedResponse(res, rows, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};
