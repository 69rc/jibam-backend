import { Op } from 'sequelize';
import { Product, Category, ProductImage, Review, User } from '../models/index.js';
import {
  successResponse,
  errorResponse,
  paginatedResponse,
  getPagination,
  getPaginationMeta,
} from '../utils/apiResponse.js';
import { deleteImage } from '../config/cloudinary.js';

// GET /products — with filters, search, pagination
export const getProducts = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const {
      search,
      categoryId,
      manufacturer,
      minPrice,
      maxPrice,
      prescriptionRequired,
      isFeatured,
      isNewArrival,
      isBestSeller,
      inStock,
    } = req.query;

    const where = { isActive: true };

    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
        { manufacturer: { [Op.iLike]: `%${search}%` } },
      ];
    }

    if (categoryId) where.categoryId = categoryId;
    if (manufacturer) where.manufacturer = { [Op.iLike]: `%${manufacturer}%` };
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price[Op.gte] = parseFloat(minPrice);
      if (maxPrice) where.price[Op.lte] = parseFloat(maxPrice);
    }
    if (prescriptionRequired !== undefined) {
      where.prescriptionRequired = prescriptionRequired === 'true';
    }
    if (isFeatured === 'true') where.isFeatured = true;
    if (isNewArrival === 'true') where.isNewArrival = true;
    if (isBestSeller === 'true') where.isBestSeller = true;
    if (inStock === 'true') where.stock = { [Op.gt]: 0 };

    const { count, rows } = await Product.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        { model: Category, as: 'category', attributes: ['id', 'name', 'slug'] },
        {
          model: ProductImage,
          as: 'images',
          attributes: ['id', 'url', 'isPrimary', 'sortOrder'],
          separate: true,
          order: [['sortOrder', 'ASC']],
        },
      ],
    });

    return paginatedResponse(res, rows, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

// GET /products/:id
export const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findOne({
      where: { id: req.params.id, isActive: true },
      include: [
        { model: Category, as: 'category', attributes: ['id', 'name', 'slug'] },
        {
          model: ProductImage,
          as: 'images',
          attributes: ['id', 'url', 'isPrimary', 'sortOrder'],
          order: [['sortOrder', 'ASC']],
        },
        {
          model: Review,
          as: 'reviews',
          where: { isApproved: true },
          required: false,
          limit: 10,
          order: [['createdAt', 'DESC']],
          include: [{ model: User, as: 'user', attributes: ['id', 'fullname', 'avatar'] }],
        },
      ],
    });

    if (!product) return errorResponse(res, 'Product not found', 404);

    // Get related products in the same category
    const related = await Product.findAll({
      where: {
        categoryId: product.categoryId,
        id: { [Op.ne]: product.id },
        isActive: true,
      },
      limit: 8,
      attributes: ['id', 'name', 'price', 'comparePrice', 'image', 'stock', 'averageRating', 'totalReviews'],
    });

    return successResponse(res, { product, related });
  } catch (error) {
    next(error);
  }
};

// GET /products/category/:categoryId
export const getProductsByCategory = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);

    const category = await Category.findByPk(req.params.categoryId);
    if (!category) return errorResponse(res, 'Category not found', 404);

    const { count, rows } = await Product.findAndCountAll({
      where: { categoryId: req.params.categoryId, isActive: true },
      limit,
      offset,
      order: [['isFeatured', 'DESC'], ['createdAt', 'DESC']],
      include: [
        {
          model: ProductImage,
          as: 'images',
          attributes: ['id', 'url', 'isPrimary'],
          limit: 1,
          order: [['isPrimary', 'DESC']],
        },
      ],
    });

    return paginatedResponse(res, rows, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

// POST /products (admin)
export const createProduct = async (req, res, next) => {
  try {
    const {
      categoryId,
      name,
      description,
      manufacturer,
      dosage,
      price,
      comparePrice,
      stock,
      prescriptionRequired,
      isFeatured,
      isNewArrival,
      isBestSeller,
      tags,
      sideEffects,
      usageInstructions,
    } = req.body;

    const category = await Category.findByPk(categoryId);
    if (!category) return errorResponse(res, 'Category not found', 404);

    // Handle primary image
    const primaryImage = req.files?.['image']?.[0];
    const image = primaryImage ? primaryImage.path : null;
    const imagePublicId = primaryImage ? primaryImage.filename : null;

    const product = await Product.create({
      categoryId,
      name,
      description,
      manufacturer,
      dosage,
      price: parseFloat(price),
      comparePrice: comparePrice ? parseFloat(comparePrice) : null,
      stock: parseInt(stock) || 0,
      prescriptionRequired: prescriptionRequired === 'true' || prescriptionRequired === true,
      isFeatured: isFeatured === 'true' || isFeatured === true,
      isNewArrival: isNewArrival === 'true' || isNewArrival === true,
      isBestSeller: isBestSeller === 'true' || isBestSeller === true,
      tags: tags ? (typeof tags === 'string' ? JSON.parse(tags) : tags) : [],
      sideEffects,
      usageInstructions,
      image,
      imagePublicId,
    });

    // Handle additional images
    const additionalImages = req.files?.['images'] || [];
    if (additionalImages.length > 0) {
      const imageRecords = additionalImages.map((file, index) => ({
        productId: product.id,
        url: file.path,
        publicId: file.filename,
        isPrimary: index === 0 && !primaryImage,
        sortOrder: index,
      }));
      await ProductImage.bulkCreate(imageRecords);
    }

    const fullProduct = await Product.findByPk(product.id, {
      include: [
        { model: Category, as: 'category', attributes: ['id', 'name'] },
        { model: ProductImage, as: 'images' },
      ],
    });

    return successResponse(res, fullProduct, 'Product created', 201);
  } catch (error) {
    next(error);
  }
};

// PUT /products/:id (admin)
export const updateProduct = async (req, res, next) => {
  try {
    console.log('Product update request started:', {
      id: req.params.id,
      hasBody: !!req.body,
      hasFiles: !!req.files,
      contentType: req.headers['content-type'],
      bodyKeys: Object.keys(req.body || {}),
      fileKeys: req.files ? Object.keys(req.files) : []
    });

    const product = await Product.findByPk(req.params.id);
    if (!product) {
      console.log('Product not found:', req.params.id);
      return errorResponse(res, 'Product not found', 404);
    }

    const allowedFields = [
      'categoryId', 'name', 'description', 'manufacturer', 'dosage',
      'price', 'comparePrice', 'stock', 'prescriptionRequired',
      'isFeatured', 'isNewArrival', 'isBestSeller', 'tags',
      'sideEffects', 'usageInstructions', 'isActive',
    ];

    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined && req.body[field] !== null && req.body[field] !== '') {
        updateData[field] = req.body[field];
      }
    }

    // Handle primary image upload - delete old image and upload new one
    if (req.files?.['image']?.[0]) {
      console.log('New image file detected:', req.files['image'][0].originalname);
      
      // Delete old image from Cloudinary if exists
      if (product.imagePublicId) {
        await deleteImage(product.imagePublicId);
      }
      
      // Upload new image (Cloudinary handles this automatically)
      const newImage = req.files['image'][0];
      updateData.image = newImage.path;
      updateData.imagePublicId = newImage.filename;
    } else {
      console.log('No new image file detected, preserving existing image');
    }

    console.log('Update data prepared:', updateData);
    console.log('Current product image:', product.image);

    const updatedProduct = await product.update(updateData);

    console.log('Product updated successfully:', updatedProduct.id);
    console.log('Updated product image:', updatedProduct.image);

    return successResponse(res, product, 'Product updated');
  } catch (error) {
    console.error('Product update error caught:', {
      error: error,
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
      reqBody: req.body,
      reqFiles: req.files
    });
    
    // Create a proper error object if it's malformed
    if (!error || typeof error !== 'object') {
      const fallbackError = new Error('Unknown error occurred during product update');
      fallbackError.statusCode = 500;
      return next(fallbackError);
    }
    
    // Ensure error has required properties
    if (!error.message) error.message = 'Product update failed';
    if (!error.statusCode) error.statusCode = 500;
    
    next(error);
  }
};

// DELETE /products/:id (admin)
export const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return errorResponse(res, 'Product not found', 404);

    // Delete primary image from Cloudinary
    if (product.imagePublicId) {
      await deleteImage(product.imagePublicId);
    }

    // Delete additional images from Cloudinary
    const productImages = await ProductImage.findAll({
      where: { productId: product.id }
    });
    
    for (const image of productImages) {
      if (image.publicId) {
        await deleteImage(image.publicId);
      }
    }

    // Soft delete (set isActive to false)
    await product.update({ isActive: false });
    return successResponse(res, null, 'Product deleted');
  } catch (error) {
    next(error);
  }
};

// GET /products/home — home screen data
export const getHomeProducts = async (req, res, next) => {
  try {
    const [featured, newArrivals, bestSellers, categories] = await Promise.all([
      Product.findAll({
        where: { isFeatured: true, isActive: true },
        limit: 10,
        attributes: ['id', 'name', 'price', 'comparePrice', 'image', 'stock', 'averageRating', 'prescriptionRequired'],
      }),
      Product.findAll({
        where: { isNewArrival: true, isActive: true },
        limit: 10,
        order: [['createdAt', 'DESC']],
        attributes: ['id', 'name', 'price', 'comparePrice', 'image', 'stock', 'averageRating', 'prescriptionRequired'],
      }),
      Product.findAll({
        where: { isBestSeller: true, isActive: true },
        limit: 10,
        order: [['totalSold', 'DESC']],
        attributes: ['id', 'name', 'price', 'comparePrice', 'image', 'stock', 'averageRating', 'prescriptionRequired'],
      }),
      Category.findAll({
        where: { isActive: true },
        limit: 10,
        order: [['sortOrder', 'ASC']],
        attributes: ['id', 'name', 'image', 'slug'],
      }),
    ]);

    return successResponse(res, { featured, newArrivals, bestSellers, categories });
  } catch (error) {
    next(error);
  }
};
