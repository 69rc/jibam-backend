/**
 * OPay Payment Service
 *
 * Supports two OPay endpoints:
 *  - Nigerian local:     /api/v1/cashier/create          (for NG merchants)
 *  - International:      /api/v1/international/cashier/create  (for EG/PK)
 *
 * Set OPAY_ENDPOINT_TYPE=local  for Nigeria
 * Set OPAY_ENDPOINT_TYPE=international  for Egypt/Pakistan
 * Default: local (NG)
 */

import axios from 'axios';
import crypto from 'crypto';

class OPayService {
  constructor() {
    this.publicKey     = process.env.OPAY_PUBLIC_KEY;
    this.merchantId    = process.env.OPAY_MERCHANT_ID;
    this.baseUrl       = (process.env.OPAY_BASE_URL || 'https://sandboxapi.opaycheckout.com').replace(/\/$/, '');
    this.callbackUrl   = process.env.OPAY_CALLBACK_URL;
    this.returnUrl     = (process.env.OPAY_RETURN_URL  || '').replace(/\/$/, '');
    this.cancelUrl     = (process.env.OPAY_CANCEL_URL  || '').replace(/\/$/, '');
    this.country       = process.env.OPAY_COUNTRY || 'NG';
    this.webhookSecret = process.env.OPAY_WEBHOOK_SECRET;
    this.endpointType  = process.env.OPAY_ENDPOINT_TYPE || 'local'; // local | international
  }

  // ─── HTTP helper ─────────────────────────────────────────────────────────
  async _post(endpoint, body) {
    if (!this.publicKey)  throw new Error('OPAY_PUBLIC_KEY is not set');
    if (!this.merchantId) throw new Error('OPAY_MERCHANT_ID is not set');

    const url = `${this.baseUrl}${endpoint}`;
    console.log(`[OPay] POST ${url}`);
    console.log(`[OPay] Body:`, JSON.stringify(body, null, 2));

    try {
      const response = await axios.post(url, body, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.publicKey}`,
          'MerchantId':    this.merchantId,
        },
        timeout: 30000,
      });
      console.log(`[OPay] Response [${response.status}]:`, JSON.stringify(response.data, null, 2));
      return response.data;
    } catch (err) {
      const errData = err.response?.data;
      console.error(`[OPay] HTTP ${err.response?.status}:`, JSON.stringify(errData, null, 2));
      throw new Error(errData?.message || errData?.msg || err.message || 'OPay request failed');
    }
  }

  // ─── Initialize payment ───────────────────────────────────────────────────
  async initializePayment({ reference, amount, currency = 'NGN', customerEmail, customerName, customerPhone, userId, items = [], expireAt = 600 }) {
    const total    = parseFloat(amount);
    const frontEnd = (process.env.CUSTOMER_APP_URL || '').replace(/\/$/, '');
    const retUrl   = (this.returnUrl || `${frontEnd}/payment/verify`).replace(/\/+$/, '');
    const canUrl   = this.cancelUrl || `${frontEnd}/cart`;
    const cbUrl    = this.callbackUrl || '';

    // Build product list
    const productList = items.length > 0
      ? items.map((item, idx) => ({
          description: (item.productName || item.name || 'Medicine').slice(0, 100),
          imageUrl:    item.productImage || item.image || 'https://placehold.co/100',
          name:        (item.productName || item.name || 'Product').slice(0, 50),
          price:       parseFloat(item.price),
          productId:   String(item.productId || item.id || `p${idx}`).slice(0, 50),
          quantity:    parseInt(item.quantity) || 1,
        }))
      : [{
          description: 'Jibam Pharmacy Order',
          imageUrl:    'https://placehold.co/100',
          name:        'Pharmacy Products',
          price:       total,
          productId:   reference.slice(0, 50),
          quantity:    1,
        }];

    let data;

    if (this.endpointType === 'international') {
      // ── International cashier (EG/PK) ──
      const body = {
        amount:      { currency, total },
        callbackUrl: cbUrl,
        cancelUrl:   canUrl,
        country:     this.country,
        expireAt,
        merchantId:  this.merchantId,
        productList,
        reference,
        returnUrl:   `${retUrl}?reference=${reference}`,
        userInfo: {
          userEmail:  customerEmail  || '',
          userId:     String(userId  || ''),
          userMobile: customerPhone  || '',
          userName:   customerName   || '',
        },
      };
      data = await this._post('/api/v1/international/cashier/create', body);

    } else {
      // ── Nigerian local cashier (NG) ──
      // Amount in kobo (smallest unit) for local Nigerian endpoint
      const amountKobo = Math.round(total * 100);

      const body = {
        amount:     { currency, total: amountKobo },
        callbackUrl: cbUrl,
        cancelUrl:   canUrl,
        country:     this.country,
        expireAt,
        productList,
        reference,
        returnUrl:   `${retUrl}?reference=${reference}`,
        userInfo: {
          userEmail:  customerEmail || '',
          userId:     String(userId  || ''),
          userMobile: customerPhone  || '',
          userName:   customerName   || '',
        },
      };
      data = await this._post('/api/v1/cashier/create', body);
    }

    if (data.code !== '00000') {
      throw new Error(`OPay [${data.code}]: ${data.message || data.msg || 'Unknown error'}`);
    }

    return {
      success:    true,
      cashierUrl: data.data?.cashierUrl || data.data?.url,
      reference,
      expireAt:   data.data?.expireAt,
      raw:        data.data,
    };
  }

  // ─── Verify payment ───────────────────────────────────────────────────────
  async verifyPayment(reference) {
    const endpoint = this.endpointType === 'international'
      ? '/api/v1/international/cashier/query'
      : '/api/v1/cashier/query';

    const body = { country: this.country, reference };
    const data = await this._post(endpoint, body);

    if (data.code !== '00000') {
      throw new Error(`OPay query [${data.code}]: ${data.message || 'Query failed'}`);
    }

    const status = (data.data?.status || data.data?.orderStatus || '').toUpperCase();
    return {
      success:       status === 'SUCCESS',
      status:        status.toLowerCase(),
      transactionId: data.data?.transId || data.data?.orderNo,
      channel:       data.data?.payChannel || 'opay',
      amount:        data.data?.amount?.total,
      currency:      data.data?.amount?.currency,
      paidAt:        data.data?.finishTime ? new Date(data.data.finishTime) : new Date(),
      raw:           data.data,
    };
  }

  // ─── Refund ───────────────────────────────────────────────────────────────
  async refundPayment(reference, amount, reason = 'Customer request') {
    const endpoint = this.endpointType === 'international'
      ? '/api/v1/international/cashier/refund'
      : '/api/v1/cashier/refund';

    const body = {
      country:   this.country,
      reference,
      amount:    { total: parseFloat(amount), currency: 'NGN' },
      reason,
    };

    const data = await this._post(endpoint, body);
    return { success: data.code === '00000', message: data.message, raw: data.data };
  }

  // ─── Webhook verification ─────────────────────────────────────────────────
  verifyWebhookSignature(payload, receivedSignature) {
    if (!this.webhookSecret || !receivedSignature) return false;
    const expected = crypto
      .createHmac('sha512', this.webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');
    return expected === receivedSignature;
  }
}

export default new OPayService();
