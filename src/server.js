import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
import settingsRoutes from './routes/settings.routes.js';

dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars);
  console.error('Please set these environment variables and restart the server');
  // In production, we might want to fail fast
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  }
}

const app = express();
const PORT = process.env.PORT || 5001;
const isProduction = process.env.NODE_ENV === 'production';

// ─── Trust proxy (required for Vercel / any reverse proxy) ────────────────────
// Tells Express to trust X-Forwarded-For headers from the proxy layer.
// This fixes express-rate-limit's ERR_ERL_UNEXPECTED_X_FORWARDED_FOR error.
app.set('trust proxy', 1);

// ─── Security & Parsing Middleware ────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ─── CORS ─────────────────────────────────────────────────────────────────────
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) return callback(null, true);

    // In production: allow Vercel preview URLs + configured origins
    if (isProduction) {
      const allowedPatterns = [
        /\.vercel\.app$/,               // any vercel.app subdomain
        /\.neon\.tech$/,                // neon direct connections
      ];

      const configuredOrigins = [
        process.env.CUSTOMER_APP_URL,
        process.env.ADMIN_DASHBOARD_URL,
      ].filter(Boolean);

      const isAllowedPattern = allowedPatterns.some((p) => p.test(origin));
      const isConfigured = configuredOrigins.includes(origin);

      if (isAllowedPattern || isConfigured) return callback(null, true);

      // Log but don't block in production to avoid breaking during testing
      console.warn(`CORS: origin not in allowlist — ${origin}`);
      return callback(null, true); // remove this line after testing
    }

    // Development: allow all local origins
    const isLocal =
      origin.includes('localhost') ||
      origin.includes('127.0.0.1') ||
      /^https?:\/\/192\.168\./.test(origin) ||
      /^https?:\/\/10\./.test(origin);

    if (isLocal) return callback(null, true);

    callback(new Error(`CORS policy: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200,
};

app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

app.use(compression());

// ─── Paystack webhook raw body ────────────────────────────────────────────────
// CRITICAL: Paystack signs its webhook payloads with HMAC-SHA512 over the RAW
// request body. If we let express.json() parse the body first, the raw stream
// is consumed and req.rawBody comes back empty — signature verification fails
// and orders are never automatically marked as PAID.
// Register this BEFORE express.json() so we capture the untouched body.
app.post(
  '/api/v1/payments/webhook',
  express.raw({ type: 'application/json', limit: '2mb' }),
  (req, res, next) => {
    req.rawBody = req.body.toString('utf8');
    try {
      req.body = JSON.parse(req.rawBody);
    } catch {
      req.body = {};
    }
    next();
  }
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan(isProduction ? 'combined' : 'dev'));

// Serve static files (uploaded images)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
app.use('/api', generalLimiter);

// ─── Ensure DB Connection (for Vercel serverless) ─────────────────────────────
app.use(async (req, res, next) => {
  if (process.env.VERCEL === '1') {
    try {
      await ensureDB();
    } catch (err) {
      return res.status(503).json({
        status: 'error',
        message: 'Database connection failed',
        error: err.message,
      });
    }
  }
  next();
});

// ─── Root Route ────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    message: 'Jibam Pharmacy API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: '/api/v1',
    },
    documentation: 'https://github.com/69rc/jibam',
  });
});

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({
      status: 'ok',
      service: 'Jibam Pharmacy API',
      version: '1.0.0',
      database: 'connected',
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV,
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      service: 'Jibam Pharmacy API',
      database: 'disconnected',
      error: err.message,
    });
  }
});

// ─── API Routes ───────────────────────────────────────────────────────────────
const API = '/api/v1';
app.use(`${API}/auth`,          authRoutes);
app.use(`${API}/categories`,    categoryRoutes);
app.use(`${API}/products`,      productRoutes);
app.use(`${API}/cart`,          cartRoutes);
app.use(`${API}/orders`,        orderRoutes);
app.use(`${API}/payments`,      paymentRoutes);
app.use(`${API}/payments/opay`, opayRoutes);
app.use(`${API}/wishlist`,      wishlistRoutes);
app.use(`${API}/notifications`, notificationRoutes);
app.use(`${API}/addresses`,     addressRoutes);
app.use(`${API}/admin`,         adminRoutes);
app.use(`${API}/settings`,      settingsRoutes);

// ─── 404 & Error Handlers ─────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── DB connect (lazy — happens on first request on Vercel serverless) ────────
let dbReady = false;
const ensureDB = async () => {
  if (dbReady) return;
  try {
    await sequelize.authenticate();
    dbReady = true;
    console.log('✅ DB connected');
  } catch (err) {
    console.error('DB connect error:', err.message);
    throw err;
  }
};

// ─── Local dev server (NOT used by Vercel) ────────────────────────────────────
if (process.env.VERCEL !== '1' && process.env.NODE_ENV !== 'production') {
  // Connect DB immediately for local dev
  ensureDB().catch(() => {
    console.error('Failed to connect to database. Check your DATABASE_URL.');
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Jibam Pharmacy API → http://localhost:${PORT}`);
    console.log(`🌐 Health → http://localhost:${PORT}/health\n`);
  });
}

export default app;
