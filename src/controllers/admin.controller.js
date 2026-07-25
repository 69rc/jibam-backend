import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import { User, Order, Product, Category, Payment, Review } from '../models/index.js';
import { successResponse, errorResponse, paginatedResponse, getPagination, getPaginationMeta } from '../utils/apiResponse.js';

// GET /admin/dashboard
export const getDashboardStats = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      totalUsers,
      totalOrders,
      totalProducts,
      totalCategories,
      pendingOrders,
      todayOrders,
      monthlyRevenueResult,
      totalRevenueResult,
      recentOrders,
      lowStockProducts,
      topProducts,
    ] = await Promise.all([
      User.count({ where: { role: 'customer' } }),
      Order.count(),
      Product.count({ where: { isActive: true } }),
      Category.count({ where: { isActive: true } }),
      Order.count({ where: { status: 'pending' } }),
      Order.count({ where: { createdAt: { [Op.gte]: today } } }),
      Order.sum('total', {
        where: { paymentStatus: 'paid', createdAt: { [Op.gte]: thisMonth } },
      }),
      Order.sum('total', { where: { paymentStatus: 'paid' } }),
      Order.findAll({
        limit: 5,
        order: [['createdAt', 'DESC']],
        include: [{ model: User, as: 'user', attributes: ['id', 'fullname', 'email'] }],
      }),
      Product.findAll({
        where: { stock: { [Op.lte]: 10 }, isActive: true },
        limit: 5,
        order: [['stock', 'ASC']],
        attributes: ['id', 'name', 'stock', 'image'],
      }),
      Product.findAll({
        where: { isActive: true },
        limit: 5,
        order: [['totalSold', 'DESC']],
        attributes: ['id', 'name', 'totalSold', 'price', 'image'],
      }),
    ]);

    return successResponse(res, {
      stats: {
        totalUsers,
        totalOrders,
        totalProducts,
        totalCategories,
        pendingOrders,
        todayOrders,
        monthlyRevenue: monthlyRevenueResult || 0,
        totalRevenue: totalRevenueResult || 0,
      },
      recentOrders,
      lowStockProducts,
      topProducts,
    });
  } catch (error) {
    next(error);
  }
};

// GET /admin/users
export const getAllUsers = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { search, role, isActive } = req.query;

    const where = {};
    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where[Op.or] = [
        { fullname: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      attributes: { exclude: ['password', 'resetPasswordToken', 'resetPasswordExpires', 'refreshToken'] },
    });

    return paginatedResponse(res, rows, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

// GET /admin/users/:id
export const getUserById = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password', 'resetPasswordToken', 'resetPasswordExpires', 'refreshToken'] },
      include: [
        { model: Order, as: 'orders', attributes: ['id', 'orderNumber', 'status', 'total', 'createdAt'], limit: 5, order: [['createdAt', 'DESC']] },
      ],
    });
    if (!user) return errorResponse(res, 'User not found', 404);
    return successResponse(res, user);
  } catch (error) {
    next(error);
  }
};

// PUT /admin/users/:id/status
export const toggleUserStatus = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return errorResponse(res, 'User not found', 404);
    if (user.role === 'admin') return errorResponse(res, 'Cannot deactivate admin accounts', 403);
    await user.update({ isActive: !user.isActive });
    return successResponse(res, { isActive: user.isActive }, `User ${user.isActive ? 'activated' : 'deactivated'}`);
  } catch (error) {
    next(error);
  }
};

// GET /admin/analytics/sales
export const getSalesAnalytics = async (req, res, next) => {
  try {
    const { period = 'month' } = req.query;
    const now = new Date();

    let startDate;
    if (period === 'week') startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    else if (period === 'month') startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (period === 'year') startDate = new Date(now.getFullYear(), 0, 1);
    else startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const salesData = await Order.findAll({
      where: {
        paymentStatus: 'paid',
        createdAt: { [Op.gte]: startDate },
      },
      attributes: [
        [sequelize.fn('DATE_TRUNC', 'day', sequelize.col('createdAt')), 'date'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'orders'],
        [sequelize.fn('SUM', sequelize.col('total')), 'revenue'],
      ],
      group: [sequelize.fn('DATE_TRUNC', 'day', sequelize.col('createdAt'))],
      order: [[sequelize.fn('DATE_TRUNC', 'day', sequelize.col('createdAt')), 'ASC']],
      raw: true,
    });

    const statusBreakdown = await Order.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      group: ['status'],
      raw: true,
    });

    return successResponse(res, { salesData, statusBreakdown });
  } catch (error) {
    next(error);
  }
};
