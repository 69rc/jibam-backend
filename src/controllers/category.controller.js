import { Op } from 'sequelize';
import { Category, Product } from '../models/index.js';
import {
  successResponse,
  errorResponse,
  paginatedResponse,
  getPagination,
  getPaginationMeta,
} from '../utils/apiResponse.js';

// GET /categories
export const getCategories = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { search, activeOnly } = req.query;

    const where = {};
    if (activeOnly !== 'false') where.isActive = true;
    if (search) where.name = { [Op.iLike]: `%${search}%` };

    const { count, rows } = await Category.findAndCountAll({
      where,
      limit,
      offset,
      order: [['sortOrder', 'ASC'], ['name', 'ASC']],
      include: [
        {
          model: Product,
          as: 'products',
          attributes: ['id'],
          where: { isActive: true },
          required: false,
        },
      ],
    });

    const data = rows.map((cat) => ({
      ...cat.toJSON(),
      productCount: cat.products?.length || 0,
      products: undefined,
    }));

    return paginatedResponse(res, data, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

// GET /categories/:id
export const getCategoryById = async (req, res, next) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) return errorResponse(res, 'Category not found', 404);
    return successResponse(res, category);
  } catch (error) {
    next(error);
  }
};

// POST /categories (admin)
export const createCategory = async (req, res, next) => {
  try {
    const { name, description, sortOrder } = req.body;

    const image = req.file ? req.file.path : null;
    const imagePublicId = req.file ? req.file.filename : null;

    const category = await Category.create({
      name,
      description,
      image,
      imagePublicId,
      sortOrder: sortOrder || 0,
    });

    return successResponse(res, category, 'Category created', 201);
  } catch (error) {
    next(error);
  }
};

// PUT /categories/:id (admin)
export const updateCategory = async (req, res, next) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) return errorResponse(res, 'Category not found', 404);

    const { name, description, sortOrder, isActive } = req.body;
    const updateData = {};

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (isActive !== undefined) updateData.isActive = isActive;

    if (req.file) {
      updateData.image = req.file.path;
      updateData.imagePublicId = req.file.filename;
    }

    await category.update(updateData);

    return successResponse(res, category, 'Category updated');
  } catch (error) {
    next(error);
  }
};

// DELETE /categories/:id (admin)
export const deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) return errorResponse(res, 'Category not found', 404);

    const productCount = await Product.count({ where: { categoryId: req.params.id } });
    if (productCount > 0) {
      return errorResponse(res, `Cannot delete category with ${productCount} products. Reassign or delete products first.`, 400);
    }

    await category.destroy();
    return successResponse(res, null, 'Category deleted');
  } catch (error) {
    next(error);
  }
};
