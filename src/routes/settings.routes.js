import { Router } from 'express';
import { getDeliveryZones, getPromoBanners } from '../controllers/settings.controller.js';

const router = Router();

// Public — customer app fetches these
router.get('/delivery-zones', getDeliveryZones);
router.get('/promo-banners', getPromoBanners);

export default router;
