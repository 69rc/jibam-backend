import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Order = sequelize.define(
  'Order',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    orderNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,   // generated before insert — either via beforeCreate hook or controller
      unique: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    subtotal: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    deliveryFee: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
    },
    discount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
    },
    total: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(30),
      defaultValue: 'pending',
      validate: {
        isIn: [['pending', 'paid', 'processing', 'ready', 'out_for_delivery', 'delivered', 'cancelled']],
      },
    },
    paymentStatus: {
      type: DataTypes.STRING(20),
      defaultValue: 'unpaid',
      validate: { isIn: [['unpaid', 'paid', 'refunded', 'failed']] },
    },
    paymentMethod: {
      type: DataTypes.STRING(50),
      defaultValue: 'paystack',
    },
    paymentReference: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    paidAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    deliveryAddress: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    deliveryPhone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    deliveryInstructions: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    promoCode: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    prescriptionUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    cancelReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: 'orders',
    hooks: {
      beforeCreate: (order) => {
        // Generate order number: JIB + timestamp + random
        const ts = Date.now().toString().slice(-6);
        const rand = Math.floor(Math.random() * 1000)
          .toString()
          .padStart(3, '0');
        order.orderNumber = `JIB${ts}${rand}`;
      },
    },
  }
);

export default Order;
