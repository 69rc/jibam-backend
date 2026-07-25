import { Wishlist, Product } from '../models/index.js';
import {
  successResponse,
  errorResponse,
  paginatedResponse,
  getPagination,
  getPaginationMeta,
} from '../utils/apiResponse.js';

// GET /wishlist
export const getWishlist = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);

    const { count, rows } = await Wishlist.findAndCountAll({
      where: { userId: req.user.id },
      limit,
      offset,
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'price', 'comparePrice', 'image', 'stock', 'prescriptionRequired', 'averageRating', 'isActive'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    return paginatedResponse(res, rows, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

// POST /wishlist
export const addToWishlist = async (req, res, next) => {
  try {
    const { productId } = req.body;

    const product = await Product.findOne({ where: { id: productId, isActive: true } });
    if (!product) return errorResponse(res, 'Product not found', 404);

    const [item, created] = await Wishlist.findOrCreate({
      where: { userId: req.user.id, productId },
      defaults: { userId: req.user.id, productId },
    });

    if (!created) {
      return successResponse(res, item, 'Already in wishlist');
    }

    return successResponse(res, item, 'Added to wishlist', 201);
  } catch (error) {
    next(error);
  }
};

// DELETE /wishlist/:productId
export const removeFromWishlist = async (req, res, next) => {
  try {
    const item = await Wishlist.findOne({
      where: { userId: req.user.id, productId: req.params.productId },
    });

    if (!item) return errorResponse(res, 'Item not in wishlist', 404);

    await item.destroy();
    return successResponse(res, null, 'Removed from wishlist');
  } catch (error) {
    next(error);
  }
};
