/**
 * Paystack Payment Service
 * Docs: https://paystack.com/docs/api/
 *
 * Required env vars:
 *   PAYSTACK_SECRET_KEY  — sk_test_xxx (test) or sk_live_xxx (production)
 *   PAYSTACK_BASE_URL    — https://api.paystack.co (default)
 *   CUSTOMER_APP_URL     — your frontend URL (used for callback_url)
 */

import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const paystackAxios = axios.create({
  baseURL: process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co',
  timeout: 30000,
  headers: {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  },
});

// Log every Paystack request in development
paystackAxios.interceptors.request.use((config) => {
  console.log(`[Paystack] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
  return config;
});

paystackAxios.interceptors.response.use(
  (res) => res,
  (err) => {
    const errData = err.response?.data;
    console.error(`[Paystack] Error ${err.response?.status}:`, JSON.stringify(errData, null, 2));
    return Promise.reject(err);
  }
);

// ─── Initialize transaction ────────────────────────────────────────────────
export const initializeTransaction = async ({ email, amount, reference, metadata = {}, fallbackOrigin = '' }) => {
  if (!process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET_KEY.includes('your_')) {
    throw new Error('PAYSTACK_SECRET_KEY is not configured. Add it to your environment variables.');
  }

  // Use explicit PAYSTACK_CALLBACK_URL if set, otherwise build from CUSTOMER_APP_URL
  const callbackUrl =
    process.env.PAYSTACK_CALLBACK_URL ||
    `${(process.env.CUSTOMER_APP_URL || '').replace(/\/$/, '')}/payment/callback`;

  const response = await paystackAxios.post('/transaction/initialize', {
    email,
    amount: Math.round(parseFloat(amount) * 100), // kobo
    reference,
    callback_url: callbackUrl,
    metadata,
    channels: ['card', 'bank', 'ussd', 'bank_transfer', 'mobile_money'],
  });

  console.log(`[Paystack] Transaction initialized — ref: ${reference}, amount: ₦${amount}`);
  return response.data;
};

// ─── Verify transaction ────────────────────────────────────────────────────
export const verifyTransaction = async (reference) => {
  const response = await paystackAxios.get(`/transaction/verify/${reference}`);
  console.log(`[Paystack] Verify ${reference} → status: ${response.data?.data?.status}`);
  return response.data;
};

// ─── List transactions (admin) ─────────────────────────────────────────────
export const listTransactions = async ({ page = 1, perPage = 50, status } = {}) => {
  const params = { page, perPage };
  if (status) params.status = status;
  const response = await paystackAxios.get('/transaction', { params });
  return response.data;
};
