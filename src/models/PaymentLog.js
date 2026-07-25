import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const PaymentLog = sequelize.define(
  'PaymentLog',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    paymentId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'payments',
        key: 'id',
      },
    },
    event: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        isIn: [['initialization', 'verification', 'webhook', 'refund', 'callback', 'error']],
      },
    },
    requestPayload: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    responsePayload: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'success',
      validate: {
        isIn: [['success', 'failed', 'pending']],
      },
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    ipAddress: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: 'payment_logs',
    timestamps: true,
    indexes: [
      {
        fields: ['paymentId'],
      },
      {
        fields: ['event'],
      },
      {
        fields: ['createdAt'],
      },
    ],
  }
);

export default PaymentLog;
