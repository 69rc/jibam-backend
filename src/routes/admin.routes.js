import { Router } from 'express';
import {
  getDashboardStats, getAllUsers, getUserById,
  toggleUserStatus, getSalesAnalytics,
} from '../controllers/admin.controller.js';
import {
  getAllSettings, updateDeliveryZones, updatePromoBanners,
} from '../controllers/settings.controller.js';
import { sendTestWhatsApp } from '../utils/whatsapp.js';
import { sendTelegramMessage, sendTelegramTestMessage } from '../utils/telegram.js';
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
router.put('/settings/promo-banners', updatePromoBanners);

// ── WhatsApp test ─────────────────────────────────────────────────────────────
router.post('/test-whatsapp', async (req, res) => {
  try {
    await sendTestWhatsApp();
    res.json({ status: 'success', message: 'Test WhatsApp sent — check your phone' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── Telegram test ─────────────────────────────────────────────────────────────
router.post('/test-telegram', async (req, res) => {
  try {
    await sendTelegramTestMessage();
    res.json({ status: 'success', message: 'Test Telegram message sent — check your Telegram' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

export default router;
