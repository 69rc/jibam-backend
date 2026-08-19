import StoreSettings from '../models/StoreSettings.js';

// Default delivery zones (used when DB has no value yet)
const DEFAULT_DELIVERY_ZONES = [
  {
    id: 'zone1',
    label: 'Central Kano',
    fee: 300,
    areas: [
      'fagge', 'dala', 'gwale', 'kano municipal', 'kano central',
      'sabon gari', 'tudun wada', 'kabuga', 'dakata', 'rijiyar lemo',
    ],
  },
  {
    id: 'zone2',
    label: 'Inner Suburbs',
    fee: 500,
    areas: [
      'nassarawa', 'tarauni', 'ungogo', 'kumbotso', 'dorayi',
      'sharada', 'danagundi', 'kawaji', 'yankura', 'sani abacha',
      'bakin zuwo', 'unguwar uku', 'hotoro', 'zango', 'diso',
      'rimin gado',
    ],
  },
  {
    id: 'zone3',
    label: 'Outer Kano',
    fee: 800,
    areas: [
      'wudil', 'gwarzo', 'rano', 'bichi', 'karaye', 'rogo',
      'sumaila', 'madobi', 'garun mallam', 'tofa', 'dawakin tofa',
      'dawakin kudu', 'kibiya', 'minjibir', 'gezawa', 'bagwai',
      'bebeji', 'ajingi', 'warawa',
    ],
  },
];

// ── GET /api/v1/settings/delivery-zones  (public) ────────────────────────────
export const getDeliveryZones = async (req, res) => {
  try {
    const setting = await StoreSettings.findOne({ where: { key: 'delivery_zones' } });
    const zones = setting ? JSON.parse(setting.value) : DEFAULT_DELIVERY_ZONES;
    res.json({ status: 'success', data: zones });
  } catch (err) {
    console.error('getDeliveryZones error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to fetch delivery zones' });
  }
};

// ── PUT /api/v1/admin/settings/delivery-zones  (admin only) ──────────────────
export const updateDeliveryZones = async (req, res) => {
  try {
    const { zones } = req.body;

    if (!Array.isArray(zones) || zones.length === 0) {
      return res.status(400).json({ status: 'error', message: 'zones must be a non-empty array' });
    }

    // Validate each zone
    for (const zone of zones) {
      if (!zone.label || typeof zone.fee !== 'number' || zone.fee < 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Each zone needs a label (string) and fee (number ≥ 0)',
        });
      }
      if (!Array.isArray(zone.areas)) {
        return res.status(400).json({ status: 'error', message: 'Each zone must have an areas array' });
      }
    }

    // Upsert
    const [setting] = await StoreSettings.upsert({
      key: 'delivery_zones',
      value: JSON.stringify(zones),
      description: 'Kano delivery zones and fees',
    });

    res.json({
      status: 'success',
      message: 'Delivery zones updated',
      data: JSON.parse(setting.value),
    });
  } catch (err) {
    console.error('updateDeliveryZones error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to update delivery zones' });
  }
};

// ── GET /api/v1/admin/settings  (admin — all settings) ───────────────────────
export const getAllSettings = async (req, res) => {
  try {
    const settings = await StoreSettings.findAll();
    const parsed = {};
    for (const s of settings) {
      try { parsed[s.key] = JSON.parse(s.value); } catch { parsed[s.key] = s.value; }
    }
    res.json({ status: 'success', data: parsed });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch settings' });
  }
};
