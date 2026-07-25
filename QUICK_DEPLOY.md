# Quick Backend Deployment Guide - Vercel + Neon

## Step 1: Create Neon Database (2 minutes)

1. Go to https://neon.tech
2. Click "Sign Up" (free)
3. After signup, click "Create a project"
4. Name it: `jibam-pharmacy-db`
5. Select region: AWS us-east-1 (or closest to you)
6. Click "Create project"
7. **Copy the connection string** - it looks like:
   ```
   postgres://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```
   Save this - you'll need it for Vercel.

## Step 2: Create Database Tables (3 minutes)

1. In Neon dashboard, click "SQL Editor" (left sidebar)
2. Click "New Query"
3. Copy and paste this SQL:

```sql
-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fullname VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'customer' CHECK (role IN ('customer', 'admin', 'pharmacist')),
  avatar VARCHAR(500),
  isEmailVerified BOOLEAN DEFAULT false,
  isActive BOOLEAN DEFAULT true,
  lastLoginAt TIMESTAMP,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  image VARCHAR(500),
  isActive BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoryId UUID REFERENCES categories(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  manufacturer VARCHAR(100),
  dosage VARCHAR(100),
  price DECIMAL(10, 2) NOT NULL,
  comparePrice DECIMAL(10, 2),
  stock INTEGER DEFAULT 0,
  prescriptionRequired BOOLEAN DEFAULT false,
  image VARCHAR(500),
  imagePublicId VARCHAR(255),
  isFeatured BOOLEAN DEFAULT false,
  isNewArrival BOOLEAN DEFAULT false,
  isBestSeller BOOLEAN DEFAULT false,
  isActive BOOLEAN DEFAULT true,
  tags TEXT[],
  sideEffects TEXT,
  usageInstructions TEXT,
  totalSold INTEGER DEFAULT 0,
  averageRating DECIMAL(3, 2) DEFAULT 0.00,
  totalReviews INTEGER DEFAULT 0,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userId UUID REFERENCES users(id) ON DELETE CASCADE,
  orderNumber VARCHAR(50) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'processing', 'ready', 'out_for_delivery', 'delivered', 'cancelled')),
  paymentStatus VARCHAR(20) DEFAULT 'unpaid' CHECK (paymentStatus IN ('unpaid', 'paid', 'refunded', 'failed')),
  total DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  deliveryFee DECIMAL(10, 2) DEFAULT 0,
  discount DECIMAL(10, 2) DEFAULT 0,
  addressId UUID,
  notes TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orderId UUID REFERENCES orders(id) ON DELETE CASCADE,
  userId UUID REFERENCES users(id) ON DELETE CASCADE,
  reference VARCHAR(100) UNIQUE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'NGN',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'refunded')),
  channel VARCHAR(50),
  gatewayResponse JSONB,
  paidAt TIMESTAMP,
  provider VARCHAR(20) DEFAULT 'paystack' CHECK (provider IN ('paystack', 'opay', 'flutterwave')),
  transactionId VARCHAR(100),
  metadata JSONB,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create payment_logs table
CREATE TABLE IF NOT EXISTS payment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paymentId UUID REFERENCES payments(id) ON DELETE CASCADE,
  event VARCHAR(50) NOT NULL CHECK (event IN ('initialization', 'verification', 'webhook', 'refund', 'callback', 'error')),
  requestPayload JSONB,
  responsePayload JSONB,
  status VARCHAR(20) DEFAULT 'success' CHECK (status IN ('success', 'failed', 'pending')),
  errorMessage TEXT,
  ipAddress VARCHAR(45),
  userAgent TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_products_category ON products(categoryId);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(userId);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(orderId);
CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(reference);
CREATE INDEX IF NOT EXISTS idx_payment_logs_payment ON payment_logs(paymentId);
```

4. Click "Run" to execute

## Step 3: Deploy to Vercel (5 minutes)

### 3.1 Create Vercel Account

1. Go to https://vercel.com
2. Click "Sign Up" (free)
3. Sign up with GitHub (recommended)

### 3.2 Import Project

1. In Vercel dashboard, click "Add New Project"
2. Select your repository: `69rc/jibam`
3. Click "Import"

### 3.3 Configure Project

**Framework Preset**: Other
**Root Directory**: `backend`
**Build Command**: (leave empty)
**Output Directory**: (leave empty)

### 3.4 Add Environment Variables

Scroll down to "Environment Variables" and add these:

```
DATABASE_URL = [paste your Neon connection string from Step 1]
JWT_SECRET = [generate one below]
JWT_REFRESH_SECRET = [generate another one below]
NODE_ENV = production
```

**Generate JWT Secrets:**
Open your terminal and run:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Run this twice to get two different secrets.

### 3.5 Deploy

1. Click "Deploy"
2. Wait for deployment to complete (1-2 minutes)
3. Copy the URL (e.g., `https://jibam-pharmacy-api.vercel.app`)

## Step 4: Test Deployment

Open your browser and test:
```
https://your-backend-url.vercel.app/health
```

You should see:
```json
{
  "status": "ok",
  "service": "Jibam Pharmacy API",
  "version": "1.0.0",
  "database": "connected",
  "timestamp": "...",
  "env": "production"
}
```

## Step 5: Test Products Endpoint

```
https://your-backend-url.vercel.app/api/v1/products
```

## Troubleshooting

**Deployment fails:**
- Check that `vercel.json` exists in the `backend` folder
- Verify all import paths use `.js` extensions
- Check Vercel build logs for errors

**Database connection fails:**
- Verify `DATABASE_URL` is correct
- Check Neon database is active
- Ensure connection string includes `?sslmode=require`

**Health endpoint returns 503:**
- Database tables may not exist
- Check Neon SQL Editor to verify tables were created

## Done!

Your backend is now deployed on Vercel with Neon database. The URL will be something like:
`https://jibam-pharmacy-api.vercel.app`

Save this URL - you'll need it for the frontend configuration.
