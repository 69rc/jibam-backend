import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';

import { generalLimiter } from './middlewares/rateLimiter.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';
import { sequelize } from './models/index.js';

// Route imports
import authRoutes from './routes/auth.routes.js';
import categoryRoutes from './routes/category.routes.js';
import productRoutes from './routes/product.routes.js';
import cartRoutes from './routes/cart.routes.js';
import orderRoutes from './routes/order.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import opayRoutes from './modules/payments/routes/opay.routes.js';
import wishlistRoutes from './routes/wishlist.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import addressRoutes from './routes/address.routes.js';
import adminRoutes from './routes/admin.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// ─── Security & Parsing Middleware ────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Allowed origins list (extend as needed for production)
const allowedOrigins = [
  process.env.CUSTOMER_APP_URL  || 'http://localhost:3000',
  process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3001',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',  // Vite default
  'http://localhost:19000', // Expo Go
  'http://localhost:19001',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:5173',
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) return callback(null, true);

    // In development: allow all localhost, 127.0.0.1, and local network IPs
    if (process.env.NODE_ENV === 'development') {
      const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');
      const isLAN = /^https?:\/\/192\.168\.\d+\.\d+/.test(origin) ||
                    /^https?:\/\/10\.\d+\.\d+\.\d+/.test(origin)  ||
                    /^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/.test(origin);
      if (isLocalhost || isLAN) return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    callback(new Error(`CORS policy: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200, // Some browsers (IE11) choke on 204
};

// Handle preflight OPTIONS requests explicitly before other middleware
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
app.use('/api', generalLimiter);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Jibam Pharmacy API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
const API = '/api/v1';
app.use(`${API}/auth`, authRoutes);
app.use(`${API}/categories`, categoryRoutes);
app.use(`${API}/products`, productRoutes);
app.use(`${API}/cart`, cartRoutes);
app.use(`${API}/orders`, orderRoutes);
app.use(`${API}/payments`, paymentRoutes);
app.use(`${API}/payments/opay`, opayRoutes);
app.use(`${API}/wishlist`, wishlistRoutes);
app.use(`${API}/notifications`, notificationRoutes);
app.use(`${API}/addresses`, addressRoutes);
app.use(`${API}/admin`, adminRoutes);

// ─── 404 & Error Handlers ─────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Database & Server Start ──────────────────────────────────────────────────
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    if (process.env.NODE_ENV !== 'production') {
      // Sync models in development (use migrations in production)
      await sequelize.sync({ alter: false });
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 Jibam Pharmacy API running on port ${PORT}`);
      console.log(`📖 Environment: ${process.env.NODE_ENV}`);
      console.log(`🌐 Health: http://localhost:${PORT}/health`);
      console.log(`📱 Mobile access: http://192.168.1.152:${PORT}/health\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
