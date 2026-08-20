/**
 * Telegram Bot Notifications — Jibam Pharmacy
 * 100% free, no approval, works instantly.
 *
 * ── ONE-TIME SETUP (3 minutes) ──────────────────────────────────────────────
 *
 * 1. Open Telegram and search for @BotFather
 * 2. Send: /newbot
 * 3. Give it a name e.g. "Jibam Pharmacy Alerts"
 * 4. Give it a username e.g. "jibam_pharmacy_bot"
 * 5. BotFather sends you a token like: 7123456789:AAHxxxxxxxxxxxxxxxxxxxxxx
 *    → Add to .env:  TELEGRAM_BOT_TOKEN=7123456789:AAHxxxxxxxxxxxxxxxxxxxxxx
 *
 * 6. Open your new bot in Telegram and send it any message (e.g. "hi")
 * 7. Visit this URL in your browser (replace YOUR_TOKEN):
 *    https://api.telegram.org/botYOUR_TOKEN/getUpdates
 * 8. Find "chat":{"id": XXXXXXXXX} — that number is your chat ID
 *    → Add to .env:  TELEGRAM_CHAT_ID=XXXXXXXXX
 *
 * That's it. Every order will now send a message to that Telegram chat.
 * ────────────────────────────────────────────────────────────────────────────
 */

import axios from 'axios';

const TELEGRAM_API = 'https://api.telegram.org';

/**
 * Send a plain text message to the configured Telegram chat.
 * Uses MarkdownV2 formatting so bold/italic work.
 */
export const sendTelegramMessage = async (message) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || token === 'your_telegram_bot_token') {
    console.warn('[Telegram] TELEGRAM_BOT_TOKEN not set — skipping notification');
    return;
  }
  if (!chatId || chatId === 'your_telegram_chat_id') {
    console.warn('[Telegram] TELEGRAM_CHAT_ID not set — skipping notification');
    return;
  }

  try {
    const response = await axios.post(
      `${TELEGRAM_API}/bot${token}/sendMessage`,
      {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML', // HTML is easier than MarkdownV2 (no escaping needed)
      },
      { timeout: 10000 }
    );
    console.log('[Telegram] ✅ Message sent — message_id:', response.data?.result?.message_id);
    return response.data;
  } catch (err) {
    console.error('[Telegram] ❌ Failed:', err.response?.data || err.message);
    // Non-fatal — don't throw
  }
};

/**
 * Format a new order alert for Telegram (HTML)
 */
export const formatOrderAlert = (order, customer) => {
  const items = (order.items || [])
    .map((i) => `  • ${i.productName} ×${i.quantity} — ₦${Number(i.total).toLocaleString()}`)
    .join('\n');

  const lines = [
    `🛒 <b>NEW ORDER — Jibam Pharmacy</b>`,
    ``,
    `📦 <b>Order #${order.orderNumber}</b>`,
    `👤 Customer: ${customer?.fullname || 'Unknown'}`,
    `📞 Phone: <a href="tel:${order.deliveryPhone || customer?.phone}">${order.deliveryPhone || customer?.phone || 'N/A'}</a>`,
    `📍 Address: ${order.deliveryAddress || 'N/A'}`,
    ``,
    `<b>Items:</b>`,
    items || '  (no items)',
    ``,
    `💰 Subtotal: ₦${Number(order.subtotal).toLocaleString()}`,
    `🚚 Delivery: ₦${Number(order.deliveryFee).toLocaleString()}`,
    order.discount > 0 ? `🏷️ Discount: -₦${Number(order.discount).toLocaleString()}` : null,
    `<b>TOTAL: ₦${Number(order.total).toLocaleString()}</b>`,
    ``,
    `⏰ ${new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}`,
    ``,
    `<i>Reply or call the customer to confirm.</i>`,
  ].filter((l) => l !== null).join('\n');

  return lines;
};

/**
 * Format a payment confirmed alert
 */
export const formatPaymentAlert = (order, customer, channel) => {
  return [
    `✅ <b>PAYMENT CONFIRMED — Jibam Pharmacy</b>`,
    ``,
    `📦 <b>Order #${order.orderNumber}</b>`,
    `👤 Customer: ${customer?.fullname || 'Unknown'}`,
    `📞 Phone: ${order.deliveryPhone || customer?.phone || 'N/A'}`,
    `📍 Address: ${order.deliveryAddress || 'N/A'}`,
    `💳 Channel: ${channel || 'Paystack'}`,
    `<b>💰 ₦${Number(order.total).toLocaleString()} PAID</b>`,
    ``,
    `<i>Order is now ready to process and dispatch.</i>`,
  ].join('\n');
};

/**
 * Send a test message — used from admin dashboard
 */
export const sendTelegramTestMessage = async () => {
  const message = [
    `✅ <b>Telegram Test — Jibam Pharmacy</b>`,
    ``,
    `Bot is connected and working correctly.`,
    `⏰ ${new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}`,
  ].join('\n');

  await sendTelegramMessage(message);
};
