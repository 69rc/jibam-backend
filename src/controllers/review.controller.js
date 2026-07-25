import { Review, Product, Order, OrderItem, User } from '../models/index.js';
import { successResponse, errorResponse, paginatedResponse, getPagination, getPaginationMeta } from '../utils/apiResponse.js';
import sequelize from '../config/database.js';

// GET /products/:productId/reviews
export const getProductReviews = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);

    const { count, rows } = await Review.findAndCountAll({
      where: { productId: req.params.productId, isApproved: true },
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [{ model: User, as: 'user', attributes: ['id', 'fullname', 'avatar'] }],
    });

    return paginatedResponse(res, rows, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

// POST /reviews
export const createReview = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { productId, orderId, rating, title, comment } = req.body;

    const product = await Product.findByPk(productId);
    if (!product) { await t.rollback(); return errorResponse(res, 'Product not found', 404); }

    // Check if already reviewed
    const existing = await Review.findOne({
      where: { userId: req.user.id, productId, ...(orderId && { orderId }) },
    });
    if (existing) { await t.rollback(); return errorResponse(res, 'You have already reviewed this product', 409); }

    // Verify purchase if orderId provided
    let isVerifiedPurchase = false;
    if (orderId) {
      const orderItem = await OrderItem.findOne({
        where: { productId },
        include: [{ model: Order, as: 'order', where: { id: orderId, userId: req.user.id, paymentStatus: 'paid' } }],
      });
      isVerifiedPurchase = !!orderItem;
    }

    const review = await Review.create(
      { userId: req.user.id, productId, orderId, rating, title, comment, isVerifiedPurchase },
      { transaction: t }
    );

    // Update product average rating
    const allReviews = await Review.findAll({ where: { productId, isApproved: true } });
    const totalReviews = allReviews.length;
    const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews;
    await product.update(
      { averageRating: parseFloat(avgRating.toFixed(2)), totalReviews },
      { transaction: t }
    );

    await t.commit();
    return successResponse(res, review, 'Review submitted', 201);
  } catch (error) {
    await t.rollback();
    next(error);
  }
};
