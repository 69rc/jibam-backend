/**
 * OPay Payment Service
 * Uses OPay Checkout API
 * Docs: https://documentation.opaycheckout.com/
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
  }

  // ─── HTTP helper ──────────────────────────────────────────────────────────
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
  async initializePayment({
    reference,
    amount,
    currency = 'NGN',
    customerEmail,
    customerName,
    customerPhone,
    userId,
    items = [],
  }) {
    const total      = parseFloat(amount);
    const frontEnd   = (process.env.CUSTOMER_APP_URL || '').replace(/\/$/, '');
    const retUrl     = (this.returnUrl || `${frontEnd}/payment/verify`).replace(/\/+$/, '');
    const canUrl     = this.cancelUrl || `${frontEnd}/cart`;
    const cbUrl      = this.callbackUrl || '';

    // Build product name/description from order items
    const productName = items.length > 0
      ? items.map((i) => i.productName || i.name).filter(Boolean).slice(0, 3).join(', ')
      : 'Jibam Pharmacy Order';

    // ── Exact format from OPay docs ──
    const payload = {
      country:     this.country,
      reference,
      amount: {
        total:    total,
        currency: currency,
      },
      callbackUrl: cbUrl,
      returnUrl:   `${retUrl}?reference=${reference}`,
      cancelUrl:   canUrl,
      product: {
        name:        productName.slice(0, 100),
        description: `Order from Jibam Pharmacy — ${items.length} item${items.length !== 1 ? 's' : ''}`,
      },
      userInfo: {
        userEmail:  customerEmail || '',
        userId:     String(userId  || ''),
        userMobile: customerPhone  || '',
        userName:   customerName   || '',
      },
    };

    const data = await this._post('/api/v1/international/cashier/create', payload);

    if (data.code !== '00000') {
      throw new Error(`OPay [${data.code}]: ${data.message || data.msg || 'Payment initialization failed'}`);
    }

    return {
      success:    true,
      cashierUrl: data.data?.cashierUrl || data.data?.url || data.data?.payUrl,
      reference,
      expireAt:   data.data?.expireAt,
      raw:        data.data,
    };
  }

  // ─── Verify / query payment ───────────────────────────────────────────────
  async verifyPayment(reference) {
    const body = {
      country:   this.country,
      reference,
    };

    const data = await this._post('/api/v1/international/cashier/query', body);

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
    const body = {
      country:   this.country,
      reference,
      amount: { total: parseFloat(amount), currency: 'NGN' },
      reason,
    };
    const data = await this._post('/api/v1/international/cashier/refund', body);
    return { success: data.code === '00000', message: data.message, raw: data.data };
  }

  // ─── Webhook signature verification ──────────────────────────────────────
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
