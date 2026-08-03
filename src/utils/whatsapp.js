/**
 * WhatsApp Notification Utility
 *
 * Supports two providers (configured via env vars):
 *
 * 1. Meta WhatsApp Business Cloud API (recommended — free tier available)
 *    Required env vars:
 *      WHATSAPP_PROVIDER=meta
 *      WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
 *      WHATSAPP_ACCESS_TOKEN=your_permanent_access_token
 *      PHARMACIST_WHATSAPP=2348012345678   ← recipient number (no +)
 *
 * 2. CallMeBot (quick setup, no account needed)
 *    Required env vars:
 *      WHATSAPP_PROVIDER=callmebot
 *      CALLMEBOT_APIKEY=your_callmebot_apikey
 *      PHARMACIST_WHATSAPP=2348012345678
 *
 * 3. Twilio (paid, most reliable)
 *    Required env vars:
 *      WHATSAPP_PROVIDER=twilio
 *      TWILIO_ACCOUNT_SID=ACxxxxx
 *      TWILIO_AUTH_TOKEN=xxxxxxxx
 *      TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
 *      PHARMACIST_WHATSAPP=2348012345678
 */

import axios from 'axios';

/**
 * Format a new order notification message
 */
export const formatOrderMessage = (order, customer) => {
  const items = order.items || [];
  const itemsList = items
    .map((i) => `  • ${i.productName} ×${i.quantity} — ₦${Number(i.total).toLocaleString()}`)
    .join('\n');

  return `🛒 *NEW ORDER — Jibam Pharmacy*

📦 Order #${order.orderNumber}
👤 Customer: ${customer?.fullname || 'Unknown'}
📞 Phone: ${order.deliveryPhone || customer?.phone || 'N/A'}
📍 Address: ${order.deliveryAddress || 'N/A'}

*Items:*
${itemsList}

💰 Subtotal: ₦${Number(order.subtotal).toLocaleString()}
🚚 Delivery: ₦${Number(order.deliveryFee).toLocaleString()}
${order.discount > 0 ? `🏷️ Discount: -₦${Number(order.discount).toLocaleString()}\n` : ''}*TOTAL: ₦${Number(order.total).toLocaleString()}*

⏰ ${new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}

_Reply to confirm or call the customer._`;
};

/**
 * Send via Meta WhatsApp Business Cloud API
 */
const sendViaMeta = async (to, message) => {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error('WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN not set');
  }

  // Ensure number has country code, no +
  const recipient = to.replace(/^\+/, '');

  const response = await axios.post(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      to: recipient,
      type: 'text',
      text: { body: message },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
};

/**
 * Send via CallMeBot (free, requires one-time setup)
 * Setup: send "I allow callmebot to send me messages" to +34 644 59 87 23 on WhatsApp
 */
const sendViaCallMeBot = async (to, message) => {
  const apiKey = process.env.CALLMEBOT_APIKEY;

  if (!apiKey) throw new Error('CALLMEBOT_APIKEY not set');

  const phone = to.replace(/^\+/, '');
  const encodedMsg = encodeURIComponent(message);

  const response = await axios.get(
    `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodedMsg}&apikey=${apiKey}`
  );

  return response.data;
};

/**
 * Send via Twilio WhatsApp Sandbox / Business
 */
const sendViaTwilio = async (to, message) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

  if (!accountSid || !authToken) {
    throw new Error('TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not set');
  }

  const toNumber = `whatsapp:+${to.replace(/^\+/, '')}`;

  const response = await axios.post(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    new URLSearchParams({ From: from, To: toNumber, Body: message }),
    {
      auth: { username: accountSid, password: authToken },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );

  return response.data;
};

/**
 * Main function — send WhatsApp message to the pharmacist
 * Automatically picks provider from WHATSAPP_PROVIDER env var
 * Falls back gracefully if env vars are missing
 */
export const sendWhatsAppNotification = async (to, message) => {
  const provider = (process.env.WHATSAPP_PROVIDER || 'meta').toLowerCase();
  const recipient = to || process.env.PHARMACIST_WHATSAPP;

  if (!recipient) {
    console.warn('[WhatsApp] PHARMACIST_WHATSAPP not set — skipping notification');
    return;
  }

  try {
    switch (provider) {
      case 'meta':
        await sendViaMeta(recipient, message);
        break;
      case 'callmebot':
        await sendViaCallMeBot(recipient, message);
        break;
      case 'twilio':
        await sendViaTwilio(recipient, message);
        break;
      default:
        console.warn(`[WhatsApp] Unknown provider "${provider}" — skipping`);
        return;
    }
    console.log(`[WhatsApp] ✅ Notification sent via ${provider} to ${recipient}`);
  } catch (err) {
    // Non-fatal — log but don't crash the order flow
    console.error(`[WhatsApp] ❌ Failed to send via ${provider}:`, err.response?.data || err.message);
  }
};

/**
 * Send new order notification to pharmacist
 */
export const notifyPharmacistNewOrder = async (order, customer) => {
  const message = formatOrderMessage(order, customer);
  const pharmacistNumber = process.env.PHARMACIST_WHATSAPP;
  await sendWhatsAppNotification(pharmacistNumber, message);
};
