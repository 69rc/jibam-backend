import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Product = sequelize.define(
  'Product',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    categoryId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 200],
      },
    },
    slug: {
      type: DataTypes.STRING(250),
      allowNull: true,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    manufacturer: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    dosage: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    comparePrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    stock: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    prescriptionRequired: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    image: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    imagePublicId: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    isFeatured: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isNewArrival: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isBestSeller: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    tags: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
    sideEffects: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    usageInstructions: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    totalSold: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    averageRating: {
      type: DataTypes.DECIMAL(3, 2),
      defaultValue: 0.0,
    },
    totalReviews: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    tableName: 'products',
    hooks: {
      beforeCreate: (product) => {
        if (product.name) {
          product.slug = product.name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
        }
      },
      beforeUpdate: (product) => {
        // Prevent image from being set to null/empty string during update
        if (product.changed('image') && (product.image === '' || product.image === null)) {
          console.log('Preventing image from being set to null/empty:', product.image);
          // Revert the change by not updating the image field
          product.image = product.previous('image');
        }
        if (product.changed('imagePublicId') && (product.imagePublicId === '' || product.imagePublicId === null)) {
          console.log('Preventing imagePublicId from being set to null/empty:', product.imagePublicId);
          product.imagePublicId = product.previous('imagePublicId');
        }
      },
    },
  }
);

export default Product;
