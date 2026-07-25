import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const paystackAxios = axios.create({
  baseURL: process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co',
  headers: {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  },
});

/**
 * Initialize a Paystack transaction
 */
export const initializeTransaction = async ({ email, amount, reference, metadata = {} }) => {
  const response = await paystackAxios.post('/transaction/initialize', {
    email,
    amount: Math.round(amount * 100), // Convert to kobo
    reference,
    callback_url: `${process.env.CUSTOMER_APP_URL}/payment/callback`,
    metadata,
  });
  return response.data;
};

/**
 * Verify a Paystack transaction
 */
export const verifyTransaction = async (reference) => {
  const response = await paystackAxios.get(`/transaction/verify/${reference}`);
  return response.data;
};

/**
 * List transactions
 */
export const listTransactions = async ({ page = 1, perPage = 50, status } = {}) => {
  const params = { page, perPage };
  if (status) params.status = status;
  const response = await paystackAxios.get('/transaction', { params });
  return response.data;
};
