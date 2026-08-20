/**
 * Payment Fulfillment Helpers
 *
 * Stock is NOT deducted and the cart is NOT cleared when an order is placed.
 * Inventory is only reserved AFTER the customer's payment is confirmed, so
 * unpaid orders never reduce stock or wipe the customer's cart.
 */

import { Cart, CartItem, Order, OrderItem, Product } from '../models/index.js';

/**
 * Deduct stock for an order's items and remove only the purchased items from
 * the customer's cart. Called AFTER payment is confirmed (webhook/verify).
 * Safe to run more than once — a product can only be deducted down to the
 * quantity actually ordered, and already-paid orders short-circuit upstream.
 */
export async function fulfillOrderItems(orderId, userId) {
  const order = await Order.findByPk(orderId, {
    include: [{ model: OrderItem, as: 'items' }],
  });
  if (!order || !order.items || order.items.length === 0) return;

  for (const item of order.items) {
    if (!item.productId) continue;
    await Product.increment('totalSold', { by: item.quantity, where: { id: item.productId } });
    await Product.decrement('stock', { by: item.quantity, where: { id: item.productId } });
  }

  // Remove only the items that were bought — anything else the customer
  // added to the cart since placing the order is preserved.
  const productIds = order.items.map((i) => i.productId).filter(Boolean);
  if (productIds.length === 0) return;

  const cart = await Cart.findOne({ where: { userId } });
  if (!cart) return;

  await CartItem.destroy({
    where: { cartId: cart.id, productId: productIds },
  });
}
