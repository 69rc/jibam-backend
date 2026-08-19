import { Router } from 'express';
import { getDeliveryZones } from '../controllers/settings.controller.js';

const router = Router();

// Public — customer app fetches delivery zones
router.get('/delivery-zones', getDeliveryZones);

export default router;
