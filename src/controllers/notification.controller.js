import { Notification } from '../models/index.js';
import { successResponse, errorResponse, paginatedResponse, getPagination, getPaginationMeta } from '../utils/apiResponse.js';

// GET /notifications
export const getNotifications = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { unreadOnly } = req.query;

    const where = { userId: req.user.id };
    if (unreadOnly === 'true') where.isRead = false;

    const { count, rows } = await Notification.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    const unreadCount = await Notification.count({ where: { userId: req.user.id, isRead: false } });

    return paginatedResponse(res, rows, { ...getPaginationMeta(count, page, limit), unreadCount });
  } catch (error) {
    next(error);
  }
};

// PUT /notifications/:id/read
export const markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!notification) return errorResponse(res, 'Notification not found', 404);
    await notification.update({ isRead: true });
    return successResponse(res, notification, 'Marked as read');
  } catch (error) {
    next(error);
  }
};

// PUT /notifications/read-all
export const markAllAsRead = async (req, res, next) => {
  try {
    await Notification.update(
      { isRead: true },
      { where: { userId: req.user.id, isRead: false } }
    );
    return successResponse(res, null, 'All notifications marked as read');
  } catch (error) {
    next(error);
  }
};
