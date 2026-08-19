import { Router } from 'express';
import {
  getDashboardStats, getAllUsers, getUserById,
  toggleUserStatus, getSalesAnalytics,
} from '../controllers/admin.controller.js';
import {
  getAllSettings, updateDeliveryZones,
} from '../controllers/settings.controller.js';
import { protect, restrictTo } from '../middlewares/auth.js';

const router = Router();
router.use(protect, restrictTo('admin'));
router.get('/dashboard', getDashboardStats);
router.get('/users', getAllUsers);
router.get('/users/:id', getUserById);
router.put('/users/:id/status', toggleUserStatus);
router.get('/analytics/sales', getSalesAnalytics);

// ── Store Settings ────────────────────────────────────────────────────────────
router.get('/settings', getAllSettings);
router.put('/settings/delivery-zones', updateDeliveryZones);

export default router;
