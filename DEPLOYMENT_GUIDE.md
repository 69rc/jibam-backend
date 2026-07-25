# OPay Payment Gateway Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the OPay payment gateway integration to production environments.

---

## Prerequisites

### Before Deployment

- OPay merchant account approved and active
- Production API credentials obtained from OPay
- SSL certificate installed on production server (required for webhooks)
- Database access for running migrations
- Production environment variables configured

---

## Step 1: Database Migration

### Run Database Migrations

The Payment model has been updated with new fields. Run the following SQL to update your production database:

```sql
-- Add provider field to payments table
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS provider VARCHAR(20) DEFAULT 'paystack';

-- Add constraint for provider values
ALTER TABLE payments 
ADD CONSTRAINT check_provider 
CHECK (provider IN ('paystack', 'opay', 'flutterwave'));

-- Add transaction_id field
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(100);

-- Create payment_logs table
CREATE TABLE IF NOT EXISTS payment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  event VARCHAR(50) NOT NULL CHECK (event IN ('initialization', 'verification', 'webhook', 'refund', 'callback', 'error')),
  request_payload JSONB,
  response_payload JSONB,
  status VARCHAR(20) DEFAULT 'success' CHECK (status IN ('success', 'failed', 'pending')),
  error_message TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_logs_payment_id ON payment_logs(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_event ON payment_logs(event);
CREATE INDEX IF NOT EXISTS idx_payment_logs_created_at ON payment_logs(created_at);
```

### Verify Migration

```sql
-- Check payments table structure
\d payments

-- Check payment_logs table exists
SELECT * FROM payment_logs LIMIT 1;

-- Verify indexes
SELECT indexname FROM pg_indexes WHERE tablename = 'payment_logs';
```

---

## Step 2: Environment Configuration

### Production Environment Variables

Add the following to your production `.env` file:

```env
# OPay Payment Gateway - Production
OPAY_MERCHANT_ID=your_production_merchant_id
OPAY_API_KEY=your_production_api_key
OPAY_SECRET_KEY=your_production_secret_key
OPAY_BASE_URL=https://api.opaycheckout.com
OPAY_CALLBACK_URL=https://your-domain.com/payment/opay/callback
OPAY_WEBHOOK_SECRET=your_production_webhook_secret
OPAY_WEBHOOK_IPS=opay_ip_1,opay_ip_2  # Optional: whitelist OPay webhook IPs
```

### Important Notes

- **Never commit `.env` files to version control**
- Use different credentials for development and production
- Generate a strong, random webhook secret
- Update `OPAY_CALLBACK_URL` to your production domain
- Obtain OPay webhook IPs from OPay support for whitelisting

---

## Step 3: OPay Dashboard Configuration

### 1. Configure Webhook URL

1. Log in to OPay Merchant Dashboard
2. Navigate to Settings → Webhooks
3. Add webhook URL: `https://your-domain.com/api/v1/payments/opay/webhook`
4. Select events to receive:
   - Payment successful
   - Payment failed
   - Payment cancelled
5. Save configuration

### 2. Configure Callback URL

1. In OPay Merchant Dashboard
2. Navigate to Settings → Callback URLs
3. Add callback URL: `https://your-domain.com/payment/opay/callback`
4. Save configuration

### 3. Test Webhook Configuration

1. Use OPay's webhook testing tool
2. Send test webhook to your endpoint
3. Verify signature verification works
4. Check payment_logs table for entries

---

## Step 4: Server Configuration

### SSL Certificate

Webhooks require HTTPS. Ensure:

1. SSL certificate is installed and valid
2. Certificate is from a trusted CA (Let's Encrypt, etc.)
3. Certificate auto-renewal is configured
4. Server redirects HTTP to HTTPS

### Firewall Configuration

Allow incoming traffic from OPay servers:

```bash
# Example using UFW (Ubuntu)
sudo ufw allow from <opay_ip_1> to any port 443
sudo ufw allow from <opay_ip_2> to any port 443

# Reload firewall
sudo ufw reload
```

### Nginx Configuration (if using Nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/key.pem;

    location /api/v1/payments/opay/webhook {
        proxy_pass http://localhost:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Increase timeout for webhook processing
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }

    location /payment/opay/callback {
        proxy_pass http://localhost:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Step 5: Deploy Backend

### Build and Deploy

```bash
# Navigate to backend directory
cd /path/to/backend

# Install dependencies
npm ci --production

# Run database migration (if using Sequelize migrations)
npm run migrate

# Start production server
npm start
```

### Using PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Start application with PM2
pm2 start src/server.js --name jibam-pharmacy-api

# Configure PM2 to start on boot
pm2 startup
pm2 save

# Monitor logs
pm2 logs jibam-pharmacy-api

# Monitor performance
pm2 monit
```

### Environment-Specific PM2 Configuration

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'jibam-pharmacy-api',
    script: './src/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5001,
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
  }]
};
```

Start with:

```bash
pm2 start ecosystem.config.js
```

---

## Step 6: Deploy Frontend

### Build for Production

```bash
# Navigate to frontend directory
cd /path/to/customer-web

# Install dependencies
npm ci

# Build for production
npm run build

# The build output will be in /dist directory
```

### Serve with Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    root /path/to/customer-web/dist;
    index index.html;

    # Serve static files
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # PWA service worker
    location /sw.js {
        add_header Cache-Control "no-cache";
    }
}
```

### Using Vercel/Netlify (Alternative)

If using a platform like Vercel or Netlify:

1. Connect your Git repository
2. Configure build command: `npm run build`
3. Configure output directory: `dist`
4. Add environment variables in platform settings
5. Deploy

---

## Step 7: Post-Deployment Testing

### 1. Health Check

```bash
curl https://your-domain.com/api/v1/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "Jibam Pharmacy API",
  "version": "1.0.0",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 2. OPay Endpoint Test

```bash
curl -X POST https://your-domain.com/api/v1/payments/opay/initialize \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"orderId": "test-order-id"}'
```

### 3. Webhook Test

Use OPay's webhook testing tool or simulate:

```bash
curl -X POST https://your-domain.com/api/v1/payments/opay/webhook \
  -H "Content-Type: application/json" \
  -H "x-opay-signature: TEST_SIGNATURE" \
  -d '{"reference": "test", "status": "success", "amount": 1000}'
```

### 4. End-to-End Test

1. Create test order in production
2. Select OPay as payment method
3. Complete payment with small amount (e.g., ₦100)
4. Verify payment status updates
5. Verify order status updates
6. Verify stock reduction
7. Verify notification sent

---

## Step 8: Monitoring Setup

### Application Monitoring

#### Using Sentry (Error Tracking)

```javascript
// In src/server.js
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

#### Using New Relic (APM)

```javascript
// In src/server.js
import newrelic from 'newrelic';

// newrelic.js configuration file should be in root
```

### Database Monitoring

Monitor:
- Connection pool usage
- Query performance
- Table sizes (especially payment_logs)
- Index usage

### Payment-Specific Monitoring

Create alerts for:
- Payment initialization failure rate > 5%
- Webhook failure rate > 5%
- Signature verification failures
- High webhook response times (> 3s)
- Payment logs table size growth

---

## Step 9: Backup Strategy

### Database Backups

```bash
# Daily backup using pg_dump
pg_dump -h localhost -U postgres -d jibam_pharmacy > backup_$(date +%Y%m%d).sql

# Compress backup
gzip backup_$(date +%Y%m%d).sql

# Upload to cloud storage (AWS S3, etc.)
aws s3 cp backup_$(date +%Y%m%d).sql.gz s3://backups/jibam-pharmacy/
```

### Retention Policy

- Keep daily backups for 7 days
- Keep weekly backups for 4 weeks
- Keep monthly backups for 12 months

---

## Step 10: Security Hardening

### 1. Environment Variables

- Store secrets in secure vault (AWS Secrets Manager, HashiCorp Vault)
- Rotate secrets regularly (every 90 days)
- Never log environment variables
- Use different secrets per environment

### 2. API Security

- Enable CORS only for trusted domains
- Implement IP whitelisting for admin endpoints
- Use HTTPS only (disable HTTP)
- Implement request size limits
- Enable security headers (Helmet.js already configured)

### 3. Webhook Security

- Always verify signatures
- Implement rate limiting
- Whitelist OPay IPs
- Log all webhook attempts
- Implement idempotency

---

## Rollback Plan

### If Issues Occur

1. **Immediate Rollback**

```bash
# Rollback to previous Git commit
git revert <commit-hash>
git push

# Restart services
pm2 restart jibam-pharmacy-api
```

2. **Database Rollback**

```bash
# Restore from backup
psql -h localhost -U postgres -d jibam_pharmacy < backup_YYYYMMDD.sql
```

3. **Feature Flag**

Implement feature flag to disable OPay:

```javascript
const opayEnabled = process.env.OPAY_ENABLED === 'true';

if (!opayEnabled) {
  return errorResponse(res, 'OPay payments temporarily disabled', 503);
}
```

---

## Maintenance

### Regular Tasks

#### Weekly
- Review payment logs for anomalies
- Check webhook delivery success rate
- Monitor payment processing times
- Review error logs

#### Monthly
- Rotate webhook secrets
- Review and update IP whitelist
- Check SSL certificate expiry
- Review payment provider updates

#### Quarterly
- Security audit
- Performance review
- Cost analysis
- Backup verification

---

## Troubleshooting Production Issues

### Webhook Not Reaching Server

1. Check SSL certificate validity
2. Verify firewall allows OPay IPs
3. Check server logs for incoming requests
4. Test webhook endpoint with curl
5. Verify webhook URL in OPay dashboard

### Payment Status Not Updating

1. Check payment_logs table for errors
2. Verify database connection
3. Check webhook signature verification
4. Review server error logs
5. Test payment verification manually

### High Response Times

1. Check database query performance
2. Review server resources (CPU, memory)
3. Check network latency to OPay API
4. Review payment_logs table size
5. Consider archiving old logs

---

## Support Contacts

### OPay Support
- Email: support@opaycheckout.com
- Phone: [Check OPay documentation]
- Documentation: https://doc.opaycheckout.com

### Internal Support
- DevOps Team: [contact]
- Database Team: [contact]
- Security Team: [contact]

---

## Appendix

### Useful Commands

```bash
# Check PM2 status
pm2 status

# View PM2 logs
pm2 logs jibam-pharmacy-api --lines 100

# Restart PM2 app
pm2 restart jibam-pharmacy-api

# Check PostgreSQL connections
SELECT count(*) FROM pg_stat_activity;

# Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

# Check recent payment logs
SELECT * FROM payment_logs 
ORDER BY created_at DESC 
LIMIT 10;
```

### Environment Variable Template

```env
# Server
NODE_ENV=production
PORT=5001

# Database
DATABASE_URL=postgresql://user:password@host:5432/jibam_pharmacy?sslmode=require

# JWT
JWT_SECRET=your_production_jwt_secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your_production_refresh_secret
JWT_REFRESH_EXPIRES_IN=7d

# OPay
OPAY_MERCHANT_ID=your_merchant_id
OPAY_API_KEY=your_api_key
OPAY_SECRET_KEY=your_secret_key
OPAY_BASE_URL=https://api.opaycheckout.com
OPAY_CALLBACK_URL=https://your-domain.com/payment/opay/callback
OPAY_WEBHOOK_SECRET=your_webhook_secret
OPAY_WEBHOOK_IPS=ip1,ip2

# Frontend URLs
CUSTOMER_APP_URL=https://your-domain.com
ADMIN_DASHBOARD_URL=https://admin.your-domain.com

# Monitoring (optional)
SENTRY_DSN=your_sentry_dsn
NEW_RELIC_LICENSE_KEY=your_new_relic_key
```
