/**
 * OPay Payment Service
 * Uses OPay International Cashier API
 * Docs: https://documentation.opaycheckout.com/
 *
 * Required env vars:
 *   OPAY_PUBLIC_KEY    — starts with OPAYPUB...
 *   OPAY_MERCHANT_ID   — 18-digit merchant ID e.g. 256621051120756
 *   OPAY_BASE_URL      — https://sandboxapi.opaycheckout.com  (sandbox)
 *                        https://api.opaycheckout.com          (production)
 *   OPAY_CALLBACK_URL  — your backend callback URL (GET, redirect after payment)
 *   OPAY_RETURN_URL    — customer return URL after payment
 *   OPAY_CANCEL_URL    — customer cancel URL
 *   OPAY_WEBHOOK_SECRET — for verifying webhook signatures
 *   OPAY_COUNTRY       — country code e.g. NG, EG (default: NG)
 */

import axios from 'axios';
import crypto from 'crypto';

class OPayService {
  constructor() {
    this.publicKey   = process.env.OPAY_PUBLIC_KEY;
    this.merchantId  = process.env.OPAY_MERCHANT_ID;
    this.baseUrl     = process.env.OPAY_BASE_URL || 'https://sandboxapi.opaycheckout.com';
    this.callbackUrl = process.env.OPAY_CALLBACK_URL;
    this.returnUrl   = process.env.OPAY_RETURN_URL;
    this.cancelUrl   = process.env.OPAY_CANCEL_URL;
    this.country     = process.env.OPAY_COUNTRY || 'NG';
    this.webhookSecret = process.env.OPAY_WEBHOOK_SECRET;
  }

  // ─── HTTP helper ───────────────────────────────────────────────────────────
  async _post(endpoint, body) {
    // Validate required env vars before making any request
    if (!this.publicKey) throw new Error('OPAY_PUBLIC_KEY is not set in environment variables');
    if (!this.merchantId) throw new Error('OPAY_MERCHANT_ID is not set in environment variables');

    const url = `${this.baseUrl}${endpoint}`;

    console.log(`[OPay] POST ${url}`);
    console.log(`[OPay] MerchantId: ${this.merchantId}`);
    console.log(`[OPay] PublicKey starts with: ${this.publicKey?.slice(0, 12)}...`);

    const response = await axios.post(url, body, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.publicKey}`,
        'MerchantId': this.merchantId,          // exact header name OPay expects
      },
      timeout: 30000,
    });
    return response.data;
  }

  // ─── Initialize cashier payment ────────────────────────────────────────────
  /**
   * Creates an OPay hosted checkout session.
   * Returns a cashier URL the customer is redirected to.
   *
   * @param {Object} p
   * @param {string}   p.reference       — unique order reference
   * @param {number}   p.amount          — total in smallest unit (kobo for NGN, or full NGN)
   * @param {string}   p.currency        — e.g. 'NGN'
   * @param {string}   p.customerEmail
   * @param {string}   p.customerName
   * @param {string}   p.customerPhone
   * @param {string}   p.userId
   * @param {Array}    p.items           — order items array
   * @param {number}   p.expireAt        — seconds until expiry (default 600 = 10 min)
   */
  async initializePayment(p) {
    const {
      reference,
      amount,
      currency = 'NGN',
      customerEmail,
      customerName,
      customerPhone,
      userId,
      items = [],
      expireAt = 600,
    } = p;

    // OPay expects amount in full units (not kobo) for NGN international cashier
    const amountValue = parseFloat(amount).toFixed(2);

    // Build product list from order items
    const productList = items.length > 0
      ? items.map((item, idx) => ({
          description: item.productName || item.name || 'Medicine',
          imageUrl:    item.productImage || item.image || 'https://via.placeholder.com/100',
          name:        item.productName || item.name || 'Product',
          price:       parseFloat(item.price),
          productId:   item.productId || item.id || `product_${idx}`,
          quantity:    item.quantity || 1,
        }))
      : [{
          description: 'Jibam Pharmacy Order',
          imageUrl:    'https://via.placeholder.com/100',
          name:        'Pharmacy Products',
          price:       parseFloat(amountValue),
          productId:   reference,
          quantity:    1,
        }];

    const payMethod = process.env.OPAY_PAY_METHOD || null; // e.g. 'BankCard' for EG/PK, leave empty for NG

    const body = {
      amount: {
        currency,
        total: parseFloat(amountValue),
      },
      callbackUrl: this.callbackUrl,
      cancelUrl:   this.cancelUrl   || `${process.env.CUSTOMER_APP_URL}/cart`,
      country:     this.country,
      expireAt,
      merchantId:  this.merchantId,
      ...(payMethod && { payMethod }),   // only include if explicitly set
      productList,
      reference,
      returnUrl:   this.returnUrl   || `${process.env.CUSTOMER_APP_URL}/payment/verify?reference=${reference}`,
      userInfo: {
        userEmail:  customerEmail  || '',
        userId:     userId         || '',
        userMobile: customerPhone  || '',
        userName:   customerName   || '',
      },
    };

    const data = await this._post('/api/v1/international/cashier/create', body);

    // OPay success code is '00000'
    if (data.code !== '00000') {
      throw new Error(data.message || 'OPay cashier creation failed');
    }

    return {
      success: true,
      cashierUrl: data.data?.cashierUrl,
      reference,
      expireAt:   data.data?.expireAt,
      raw:        data.data,
    };
  }

  // ─── Query / verify payment status ─────────────────────────────────────────
  async verifyPayment(reference) {
    const body = {
      country:    this.country,
      reference,
      merchantId: this.merchantId,
    };

    const data = await this._post('/api/v1/international/cashier/query', body);

    if (data.code !== '00000') {
      throw new Error(data.message || 'OPay payment query failed');
    }

    const status = data.data?.status;   // SUCCESS | PENDING | FAIL | CANCEL

    return {
      success:       status === 'SUCCESS',
      status:        status?.toLowerCase() || 'unknown',
      transactionId: data.data?.transId || data.data?.orderNo,
      channel:       data.data?.payChannel || 'opay',
      amount:        data.data?.amount?.total,
      currency:      data.data?.amount?.currency,
      paidAt:        data.data?.finishTime ? new Date(data.data.finishTime) : new Date(),
      raw:           data.data,
    };
  }

  // ─── Refund ────────────────────────────────────────────────────────────────
  async refundPayment(reference, amount, reason = 'Customer request') {
    const body = {
      country:   this.country,
      reference,
      amount: {
        total:    parseFloat(amount).toFixed(2),
        currency: 'NGN',
      },
      reason,
    };

    const data = await this._post('/api/v1/international/cashier/refund', body);

    return {
      success: data.code === '00000',
      message: data.message,
      raw:     data.data,
    };
  }

  // ─── Webhook signature verification ────────────────────────────────────────
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
