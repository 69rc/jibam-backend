# OPay Payment Gateway Integration Guide

## Overview

This document provides comprehensive testing instructions, API examples, and deployment guidelines for the OPay payment gateway integration in Jibam Pharmacy.

---

## Environment Configuration

### Required Environment Variables

Add these to your `.env` file:

```env
# OPay Payment Gateway
OPAY_MERCHANT_ID=your_opay_merchant_id
OPAY_API_KEY=your_opay_api_key
OPAY_SECRET_KEY=your_opay_secret_key
OPAY_BASE_URL=https://api.opaycheckout.com
OPAY_CALLBACK_URL=http://localhost:3002/payment/opay/callback
OPAY_WEBHOOK_SECRET=your_opay_webhook_secret
OPAY_WEBHOOK_IPS=192.168.1.100,192.168.1.101  # Optional: OPay webhook IPs
```

### Getting OPay Credentials

1. Sign up for an OPay merchant account at [OPay Merchant Portal](https://merchant.opaycheckout.com)
2. Navigate to API Settings
3. Generate your API Key and Secret Key
4. Note your Merchant ID
5. Configure your webhook URL in OPay dashboard: `https://your-domain.com/api/v1/payments/opay/webhook`

---

## API Endpoints

### 1. Initialize OPay Payment

**Endpoint:** `POST /api/v1/payments/opay/initialize`

**Authentication:** Required (Bearer Token)

**Request Body:**
```json
{
  "orderId": "uuid-of-order"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "OPay payment initialized successfully",
  "data": {
    "paymentId": "uuid",
    "authorizationUrl": "https://checkout.opaycheckout.com/...",
    "reference": "OPAY-1234567890-ABC12345",
    "amount": 5000.00,
    "currency": "NGN",
    "expireAt": "2024-01-01T12:30:00.000Z"
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "message": "Order not found"
}
```

### 2. Verify OPay Payment

**Endpoint:** `GET /api/v1/payments/opay/verify/:reference`

**Authentication:** Required (Bearer Token)

**URL Parameters:**
- `reference`: Payment reference from initialization

**Response (Success):**
```json
{
  "success": true,
  "message": "Payment verified successfully",
  "data": {
    "payment": {
      "id": "uuid",
      "reference": "OPAY-1234567890-ABC12345",
      "amount": 5000.00,
      "status": "success",
      "provider": "opay",
      "transactionId": "OPAY_TXN_123456",
      "paidAt": "2024-01-01T12:25:00.000Z"
    },
    "order": {
      "id": "uuid",
      "orderNumber": "ORD-123456",
      "status": "paid",
      "paymentStatus": "paid",
      "total": 5000.00
    }
  }
}
```

### 3. OPay Webhook

**Endpoint:** `POST /api/v1/payments/opay/webhook`

**Authentication:** None (Signature verification)

**Headers:**
- `x-opay-signature`: SHA512 signature of payload + webhook secret

**Request Body:**
```json
{
  "reference": "OPAY-1234567890-ABC12345",
  "status": "success",
  "amount": 5000.00,
  "transactionId": "OPAY_TXN_123456",
  "channel": "opay_wallet"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Webhook processed successfully"
}
```

### 4. OPay Callback

**Endpoint:** `GET /api/v1/payments/opay/callback`

**Authentication:** None

**Query Parameters:**
- `reference`: Payment reference
- `status`: Payment status (success, failed, cancelled)

**Behavior:** Redirects to frontend based on payment status

---

## Testing Checklist

### Pre-Integration Testing

- [ ] Environment variables configured correctly
- [ ] OPay merchant account active
- [ ] Webhook URL configured in OPay dashboard
- [ ] Database migrations run (Payment model updated, PaymentLog table created)
- [ ] Backend server running with OPay routes registered

### Payment Flow Testing

#### 1. Initialize Payment Test

**Using cURL:**
```bash
curl -X POST http://localhost:5001/api/v1/payments/opay/initialize \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"orderId": "your-order-uuid"}'
```

**Expected Result:**
- Returns payment URL and reference
- Payment record created in database with status 'pending'
- Payment log entry created for initialization event

#### 2. Payment URL Test

1. Copy `authorizationUrl` from initialization response
2. Open URL in browser
3. Complete payment using OPay test credentials
4. Verify payment completes successfully

#### 3. Verification Test

**Using cURL:**
```bash
curl -X GET http://localhost:5001/api/v1/payments/opay/verify/OPAY-1234567890-ABC12345 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Result:**
- Payment status updated to 'success'
- Order status updated to 'paid'
- Product stock reduced
- Notification created for user
- Payment log entry created for verification event

#### 4. Webhook Test

**Using cURL:**
```bash
curl -X POST http://localhost:5001/api/v1/payments/opay/webhook \
  -H "Content-Type: application/json" \
  -H "x-opay-signature: CALCULATED_SIGNATURE" \
  -d '{
    "reference": "OPAY-1234567890-ABC12345",
    "status": "success",
    "amount": 5000.00,
    "transactionId": "OPAY_TXN_123456"
  }'
```

**Expected Result:**
- Signature verified successfully
- Payment status updated
- Order status updated
- Duplicate webhook prevention works

### Error Scenario Testing

- [ ] Invalid order ID returns 404
- [ ] Already paid order returns error
- [ ] Cancelled order returns error
- [ ] Invalid signature returns 401
- [ ] Duplicate webhook handled correctly
- [ ] Network timeout handled gracefully
- [ ] Invalid reference returns 404

### Frontend Testing

- [ ] Checkout page shows OPay option
- [ ] Payment method selection works
- [ ] Payment initialization from frontend works
- [ ] Payment page shows correct provider
- [ ] Payment URL opens correctly
- [ ] Verification from frontend works
- [ ] Success/failure pages display correctly

---

## Postman Collection

### Import the following requests into Postman:

#### 1. Initialize OPay Payment
```json
{
  "info": {
    "name": "Initialize OPay Payment",
    "request": {
      "method": "POST",
      "header": [
        {
          "key": "Authorization",
          "value": "Bearer {{token}}"
        },
        {
          "key": "Content-Type",
          "value": "application/json"
        }
      ],
      "body": {
        "mode": "raw",
        "raw": "{\n  \"orderId\": \"{{orderId}}\"\n}"
      },
      "url": {
        "raw": "{{baseUrl}}/api/v1/payments/opay/initialize",
        "host": ["{{baseUrl}}"],
        "path": ["api", "v1", "payments", "opay", "initialize"]
      }
    }
  }
}
```

#### 2. Verify OPay Payment
```json
{
  "info": {
    "name": "Verify OPay Payment",
    "request": {
      "method": "GET",
      "header": [
        {
          "key": "Authorization",
          "value": "Bearer {{token}}"
        }
      ],
      "url": {
        "raw": "{{baseUrl}}/api/v1/payments/opay/verify/{{reference}}",
        "host": ["{{baseUrl}}"],
        "path": ["api", "v1", "payments", "opay", "verify", "{{reference}}"]
      }
    }
  }
}
```

#### 3. Simulate Webhook
```json
{
  "info": {
    "name": "Simulate OPay Webhook",
    "request": {
      "method": "POST",
      "header": [
        {
          "key": "Content-Type",
          "value": "application/json"
        },
        {
          "key": "x-opay-signature",
          "value": "{{webhookSignature}}"
        }
      ],
      "body": {
        "mode": "raw",
        "raw": "{\n  \"reference\": \"{{reference}}\",\n  \"status\": \"success\",\n  \"amount\": 5000,\n  \"transactionId\": \"OPAY_TXN_123456\"\n}"
      },
      "url": {
        "raw": "{{baseUrl}}/api/v1/payments/opay/webhook",
        "host": ["{{baseUrl}}"],
        "path": ["api", "v1", "payments", "opay", "webhook"]
      }
    }
  }
}
```

### Postman Variables

Set these in your Postman environment:
- `baseUrl`: http://localhost:5001
- `token`: Your JWT token
- `orderId`: Valid order UUID
- `reference`: Payment reference from initialization
- `webhookSignature`: Calculated SHA512 signature

---

## Database Schema Changes

### Payments Table (Updated)

```sql
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider VARCHAR(20) DEFAULT 'paystack';
ALTER TABLE payments ADD CONSTRAINT check_provider CHECK (provider IN ('paystack', 'opay', 'flutterwave'));
ALTER TABLE payments ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(100);
```

### PaymentLogs Table (New)

```sql
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

CREATE INDEX idx_payment_logs_payment_id ON payment_logs(payment_id);
CREATE INDEX idx_payment_logs_event ON payment_logs(event);
CREATE INDEX idx_payment_logs_created_at ON payment_logs(created_at);
```

---

## Security Considerations

### 1. Signature Verification
- Webhook signatures are verified using SHA512
- Never trust webhook requests without signature verification
- Store `OPAY_WEBHOOK_SECRET` securely

### 2. Rate Limiting
- Webhook endpoints have rate limiting (100 requests/minute)
- Trusted IPs can be whitelisted via `OPAY_WEBHOOK_IPS`
- Payment initialization limited to 10 requests/minute

### 3. Idempotency
- Duplicate webhooks are prevented using idempotency keys
- Payment verification checks existing status before processing

### 4. Data Validation
- All inputs validated using express-validator
- Order ownership verified before payment initialization
- Amounts validated on server-side

### 5. Logging
- All payment events logged to `payment_logs` table
- Sensitive credentials never logged
- IP addresses and user agents tracked for audit

---

## Troubleshooting

### Common Issues

#### 1. Payment Initialization Fails

**Symptoms:** API returns error during initialization

**Solutions:**
- Verify OPay credentials are correct
- Check order exists and belongs to user
- Ensure order is not already paid or cancelled
- Check network connectivity to OPay API

#### 2. Webhook Not Received

**Symptoms:** Payment completes but webhook not triggered

**Solutions:**
- Verify webhook URL is correctly configured in OPay dashboard
- Check server is publicly accessible (not localhost)
- Verify firewall allows incoming requests
- Check webhook signature is being sent correctly

#### 3. Signature Verification Fails

**Symptoms:** Webhook returns 401 Unauthorized

**Solutions:**
- Verify `OPAY_WEBHOOK_SECRET` matches OPay dashboard
- Check signature calculation method (SHA512)
- Ensure payload is stringified correctly before hashing
- Check for extra whitespace in payload

#### 4. Payment Status Not Updating

**Symptoms:** Payment successful but status not updated

**Solutions:**
- Check payment logs for errors
- Verify database connection
- Check order-item relationships exist
- Ensure product stock update doesn't fail

---

## Deployment Checklist

### Pre-Deployment

- [ ] All environment variables set in production
- [ ] Database migrations run on production database
- [ ] OPay webhook URL configured in OPay dashboard (use production URL)
- [ ] SSL certificate installed (required for webhooks)
- [ ] Firewall allows OPay webhook IPs
- [ ] Rate limiting configured for production load
- [ ] Error monitoring (Sentry, etc.) configured
- [ ] Logging service configured

### Post-Deployment

- [ ] Test payment flow with small amount
- [ ] Verify webhook receives events
- [ ] Check payment logs for errors
- [ ] Monitor server performance
- [ ] Test refund process if needed
- [ ] Verify notifications are sent
- [ ] Check stock reduction works correctly

---

## Monitoring

### Key Metrics to Monitor

- Payment initialization success rate
- Payment verification success rate
- Webhook delivery success rate
- Average payment processing time
- Failed payment reasons
- Duplicate webhook attempts

### Alerts to Configure

- High webhook failure rate (>5%)
- Payment initialization errors
- Signature verification failures
- Database connection errors
- High response times (>3s)

---

## Support

For OPay-specific issues:
- OPay Merchant Support: support@opaycheckout.com
- OPay Documentation: https://doc.opaycheckout.com

For integration issues:
- Check payment logs table for detailed error information
- Review server logs for stack traces
- Verify all environment variables are set correctly
