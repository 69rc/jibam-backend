import crypto from 'crypto';
import axios from 'axios';

/**
 * OPay Payment Service
 * Handles all OPay payment gateway operations
 */
class OPayService {
  constructor() {
    this.merchantId = process.env.OPAY_MERCHANT_ID;
    this.apiKey = process.env.OPAY_API_KEY;
    this.secretKey = process.env.OPAY_SECRET_KEY;
    this.baseUrl = process.env.OPAY_BASE_URL || 'https://api.opaycheckout.com';
    this.callbackUrl = process.env.OPAY_CALLBACK_URL;
    this.webhookSecret = process.env.OPAY_WEBHOOK_SECRET;
  }

  /**
   * Generate OPay signature for request authentication
   */
  generateSignature(data) {
    const sortedKeys = Object.keys(data).sort();
    const queryString = sortedKeys
      .map((key) => `${key}=${data[key]}`)
      .join('&');
    return crypto
      .createHash('sha512')
      .update(queryString + this.secretKey)
      .digest('hex');
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload, signature) {
    const expectedSignature = crypto
      .createHash('sha512')
      .update(JSON.stringify(payload) + this.webhookSecret)
      .digest('hex');
    return expectedSignature === signature;
  }

  /**
   * Initialize OPay payment
   */
  async initializePayment(paymentData) {
    try {
      const {
        reference,
        amount,
        currency = 'NGN',
        customerEmail,
        customerName,
        customerPhone,
        orderId,
        userId,
      } = paymentData;

      const payload = {
        merchantId: this.merchantId,
        reference,
        amount: amount.toString(),
        currency,
        customerName,
        customerEmail,
        customerPhone,
        callbackUrl: this.callbackUrl,
        cancelUrl: `${this.callbackUrl}?status=cancelled`,
        expireAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes expiry
        metadata: JSON.stringify({
          orderId,
          userId,
          orderType: 'pharmacy',
        }),
      };

      const signature = this.generateSignature(payload);

      const response = await axios.post(
        `${this.baseUrl}/api/v1/payment/create`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'Signature': signature,
          },
        }
      );

      return {
        success: response.data.code === '00000',
        data: response.data.data,
        message: response.data.message,
      };
    } catch (error) {
      console.error('OPay initialization error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Payment initialization failed');
    }
  }

  /**
   * Verify OPay payment status
   */
  async verifyPayment(reference) {
    try {
      const payload = {
        merchantId: this.merchantId,
        reference,
      };

      const signature = this.generateSignature(payload);

      const response = await axios.post(
        `${this.baseUrl}/api/v1/payment/query`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'Signature': signature,
          },
        }
      );

      return {
        success: response.data.code === '00000',
        data: response.data.data,
        message: response.data.message,
      };
    } catch (error) {
      console.error('OPay verification error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Payment verification failed');
    }
  }

  /**
   * Process OPay webhook
   */
  async processWebhook(payload, signature) {
    try {
      // Verify signature
      if (!this.verifyWebhookSignature(payload, signature)) {
        throw new Error('Invalid webhook signature');
      }

      const { reference, status, amount, transactionId } = payload;

      return {
        success: true,
        data: {
          reference,
          status,
          amount,
          transactionId,
        },
      };
    } catch (error) {
      console.error('OPay webhook processing error:', error.message);
      throw new Error(error.message);
    }
  }

  /**
   * Refund OPay payment (if needed)
   */
  async refundPayment(reference, amount, reason) {
    try {
      const payload = {
        merchantId: this.merchantId,
        reference,
        amount: amount.toString(),
        reason,
      };

      const signature = this.generateSignature(payload);

      const response = await axios.post(
        `${this.baseUrl}/api/v1/payment/refund`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'Signature': signature,
          },
        }
      );

      return {
        success: response.data.code === '00000',
        data: response.data.data,
        message: response.data.message,
      };
    } catch (error) {
      console.error('OPay refund error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Refund failed');
    }
  }
}

export default new OPayService();
