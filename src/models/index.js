import sequelize from '../config/database.js';
import User from './User.js';
import Category from './Category.js';
import Product from './Product.js';
import ProductImage from './ProductImage.js';
import Cart from './Cart.js';
import CartItem from './CartItem.js';
import Order from './Order.js';
import OrderItem from './OrderItem.js';
import Payment from './Payment.js';
import PaymentLog from './PaymentLog.js';
import Address from './Address.js';
import Wishlist from './Wishlist.js';
import Notification from './Notification.js';
import Review from './Review.js';
import PromoCode from './PromoCode.js';

// ─── User Associations ───────────────────────────────────────────────────────
User.hasOne(Cart, { foreignKey: 'userId', as: 'cart', onDelete: 'CASCADE' });
User.hasMany(Order, { foreignKey: 'userId', as: 'orders' });
User.hasMany(Address, { foreignKey: 'userId', as: 'addresses', onDelete: 'CASCADE' });
User.hasMany(Wishlist, { foreignKey: 'userId', as: 'wishlists', onDelete: 'CASCADE' });
User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications', onDelete: 'CASCADE' });
User.hasMany(Review, { foreignKey: 'userId', as: 'reviews' });
User.hasMany(Payment, { foreignKey: 'userId', as: 'payments' });

// ─── Category Associations ────────────────────────────────────────────────────
Category.hasMany(Product, { foreignKey: 'categoryId', as: 'products' });

// ─── Product Associations ─────────────────────────────────────────────────────
Product.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });
Product.hasMany(ProductImage, { foreignKey: 'productId', as: 'images', onDelete: 'CASCADE' });
Product.hasMany(CartItem, { foreignKey: 'productId', as: 'cartItems' });
Product.hasMany(OrderItem, { foreignKey: 'productId', as: 'orderItems' });
Product.hasMany(Wishlist, { foreignKey: 'productId', as: 'wishlists' });
Product.hasMany(Review, { foreignKey: 'productId', as: 'reviews' });

// ─── ProductImage Associations ────────────────────────────────────────────────
ProductImage.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

// ─── Cart Associations ────────────────────────────────────────────────────────
Cart.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Cart.hasMany(CartItem, { foreignKey: 'cartId', as: 'items', onDelete: 'CASCADE' });

// ─── CartItem Associations ────────────────────────────────────────────────────
CartItem.belongsTo(Cart, { foreignKey: 'cartId', as: 'cart' });
CartItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

// ─── Order Associations ───────────────────────────────────────────────────────
Order.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items', onDelete: 'CASCADE' });
Order.hasOne(Payment, { foreignKey: 'orderId', as: 'payment' });

// ─── OrderItem Associations ───────────────────────────────────────────────────
OrderItem.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });
OrderItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

// ─── Payment Associations ─────────────────────────────────────────────────────
Payment.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });
Payment.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Payment.hasMany(PaymentLog, { foreignKey: 'paymentId', as: 'logs', onDelete: 'CASCADE' });

// ─── PaymentLog Associations ───────────────────────────────────────────────────
PaymentLog.belongsTo(Payment, { foreignKey: 'paymentId', as: 'payment' });

// ─── Address Associations ─────────────────────────────────────────────────────
Address.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// ─── Wishlist Associations ────────────────────────────────────────────────────
Wishlist.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Wishlist.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

// ─── Notification Associations ────────────────────────────────────────────────
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// ─── Review Associations ──────────────────────────────────────────────────────
Review.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Review.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

export {
  sequelize,
  User,
  Category,
  Product,
  ProductImage,
  Cart,
  CartItem,
  Order,
  OrderItem,
  Payment,
  PaymentLog,
  Address,
  Wishlist,
  Notification,
  Review,
  PromoCode,
};
