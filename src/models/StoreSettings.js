import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * Generic key-value store for pharmacy settings.
 * e.g. key = "delivery_zones", value = JSON string of zone config
 */
const StoreSettings = sequelize.define(
  'StoreSettings',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    key: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    value: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    tableName: 'store_settings',
  }
);

export default StoreSettings;
