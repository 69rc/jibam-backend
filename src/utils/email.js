import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Email transporter — supports Gmail SMTP and Resend SMTP relay
 *
 * ── Option A: Gmail (free) ────────────────────────────────────────────
 *  SMTP_PROVIDER=gmail  (or leave blank)
 *  SMTP_USER=your-gmail@gmail.com
 *  SMTP_PASS=your-16-char-app-password   ← Google → Security → App Passwords
 *
 * ── Option B: Resend (3,000 emails/month free) ────────────────────────
 *  SMTP_PROVIDER=resend
 *  SMTP_USER=resend                      ← literal string "resend"
 *  SMTP_PASS=re_xxxxxxxxxxxxxxxxxxxxxxx  ← Resend API key from resend.com
 *  SMTP_FROM=Jibam Pharmacy <noreply@yourdomain.com>
 *
 *  Resend SMTP relay: host=smtp.resend.com  port=587
 * ─────────────────────────────────────────────────────────────────────
 */

const isResend = (process.env.SMTP_PROVIDER || '').toLowerCase() === 'resend';

const transportConfig = isResend
  ? {
      host: 'smtp.resend.com',
      port: 587,
      secure: false,
      auth: {
        user: 'resend',
        pass: process.env.SMTP_PASS,
      },
    }
  : {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    };

const transporter = nodemailer.createTransport(transportConfig);

// Default FROM address
const FROM_ADDRESS = process.env.SMTP_FROM ||
  `"Jibam Pharmacy" <${process.env.SMTP_USER || 'noreply@jibampharmacy.com'}>`;

/**
 * Check if email is configured before trying to send
 */
const isEmailConfigured = () => {
  if (!process.env.SMTP_PASS || process.env.SMTP_PASS === 'your_app_password') return false;
  if (!isResend && (!process.env.SMTP_USER || process.env.SMTP_USER.includes('your_email'))) return false;
  return true;
};

// ─── Brand colors ─────────────────────────────────────────────────────────────
const NAVY  = '#0D1B5E';
const CYAN  = '#00AEEF';
const LIGHT = '#E8ECF8';

const baseTemplate = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #F4F6FB; font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; }
    .wrap { max-width: 600px; margin: 32px auto; background: #fff; border-radius: 16px; overflow: hidden;
            box-shadow: 0 4px 24px rgba(13,27,94,0.10); }
    .header { background: ${NAVY}; padding: 32px 40px; text-align: center; }
    .header h1 { color: #fff; font-size: 22px; font-weight: 900; letter-spacing: 2px; margin-bottom: 4px; }
    .header p  { color: rgba(255,255,255,0.65); font-size: 13px; letter-spacing: 4px; font-weight: 700; }
    .header .cyan { color: ${CYAN}; }
    .body  { padding: 36px 40px; }
    .footer { background: ${LIGHT}; padding: 20px 40px; text-align: center;
              color: #8A93B2; font-size: 12px; }
    h2 { color: ${NAVY}; font-size: 20px; font-weight: 800; margin-bottom: 12px; }
    p  { line-height: 1.65; font-size: 14px; color: #444; margin-bottom: 12px; }
    .btn { display: inline-block; background: ${NAVY}; color: #fff !important;
           padding: 13px 32px; border-radius: 10px; text-decoration: none;
           font-weight: 700; font-size: 14px; margin: 16px 0; }
    .badge { display: inline-block; background: ${LIGHT}; color: ${NAVY};
             font-weight: 700; font-size: 13px; padding: 4px 12px;
             border-radius: 999px; margin-bottom: 8px; }
    table  { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
    th     { background: ${LIGHT}; color: ${NAVY}; font-weight: 700;
             padding: 9px 12px; text-align: left; }
    td     { padding: 9px 12px; border-bottom: 1px solid #ECEEF7; }
    .total-row td { font-weight: 800; color: ${NAVY}; font-size: 15px;
                    border-top: 2px solid ${NAVY}; }
    .alert { background: #E0F5FD; border-left: 4px solid ${CYAN};
             padding: 12px 16px; border-radius: 0 8px 8px 0;
             color: ${NAVY}; font-size: 13px; margin: 16px 0; }
    .warn  { background: #FFF3E0; border-left: 4px solid #F57C00; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>JIBAM <span class="cyan">PHARMACY</span></h1>
      <p>RC: 1948976</p>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      © ${new Date().getFullYear()} Jibam Pharmacy · RC: 1948976 ·
      <a href="mailto:${process.env.SMTP_USER}" style="color:${CYAN};">Contact Us</a>
    </div>
  </div>
</body>
</html>
`;

// ─── Welcome email ────────────────────────────────────────────────────────────
export const sendWelcomeEmail = async (user) => {
  if (!isEmailConfigured()) {
    console.warn('[Email] SMTP not configured — skipping welcome email');
    return;
  }
  const html = baseTemplate(`
    <h2>Welcome, ${user.fullname}! 🎉</h2>
    <p>Your Jibam Pharmacy account has been created. You can now browse and order quality medicines delivered to your doorstep across Nigeria.</p>
    <div class="alert">Your account email: <strong>${user.email}</strong></div>
    <p>If you did not create this account, please contact us immediately.</p>
  `);
  await transporter.sendMail({
    from: FROM_ADDRESS,
    to: user.email,
    subject: 'Welcome to Jibam Pharmacy 🏥',
    html,
  });
};

// ─── Password reset email ─────────────────────────────────────────────────────
export const sendPasswordResetEmail = async (user, resetUrl) => {
  if (!isEmailConfigured()) {
    console.warn('[Email] SMTP not configured — skipping password reset email');
    console.warn('[Email] Reset URL (log for dev):', resetUrl);
    return;
  }
  const html = baseTemplate(`
    <h2>Reset Your Password</h2>
    <p>Hi <strong>${user.fullname}</strong>,</p>
    <p>We received a request to reset your Jibam Pharmacy account password. Click the button below — the link expires in <strong>1 hour</strong>.</p>
    <a class="btn" href="${resetUrl}">Reset Password</a>
    <div class="alert warn">If you didn't request this, you can safely ignore this email. Your password won't change.</div>
    <p style="font-size:12px;color:#999;word-break:break-all;">Or copy this link: ${resetUrl}</p>
  `);
  await transporter.sendMail({
    from: FROM_ADDRESS,
    to: user.email,
    subject: 'Password Reset — Jibam Pharmacy',
    html,
  });
};

// ─── Customer order confirmation ──────────────────────────────────────────────
export const sendOrderConfirmationEmail = async (user, order) => {
  if (!isEmailConfigured()) {
    console.warn('[Email] SMTP not configured — skipping order confirmation email');
    return;
  }
  const items = order.items || [];
  const itemRows = items.map((item) => `
    <tr>
      <td>${item.productName}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:right">₦${Number(item.price).toLocaleString()}</td>
      <td style="text-align:right">₦${Number(item.total).toLocaleString()}</td>
    </tr>`).join('');

  const html = baseTemplate(`
    <h2>Order Confirmed! 🎉</h2>
    <p>Hi <strong>${user.fullname}</strong>, thank you for your order.</p>
    <span class="badge">Order #${order.orderNumber}</span>

    <table>
      <thead>
        <tr><th>Product</th><th>Qty</th><th>Price</th><th>Total</th></tr>
      </thead>
      <tbody>
        ${itemRows}
        <tr><td colspan="3">Delivery Fee</td><td style="text-align:right">₦${Number(order.deliveryFee || 500).toLocaleString()}</td></tr>
        ${Number(order.discount) > 0
          ? `<tr><td colspan="3">Discount</td><td style="text-align:right;color:#0090CC">-₦${Number(order.discount).toLocaleString()}</td></tr>`
          : ''}
        <tr class="total-row">
          <td colspan="3">Total Paid</td>
          <td style="text-align:right">₦${Number(order.total).toLocaleString()}</td>
        </tr>
      </tbody>
    </table>

    <p><strong>Delivery to:</strong> ${order.deliveryAddress || 'N/A'}</p>
    <p><strong>Phone:</strong> ${order.deliveryPhone || 'N/A'}</p>

    <div class="alert">We will notify you when your order is out for delivery.</div>
  `);

  await transporter.sendMail({
    from: FROM_ADDRESS,
    to: user.email,
    subject: `Order Confirmed — #${order.orderNumber} | Jibam Pharmacy`,
    html,
  });
};

// ─── Pharmacist new order alert ───────────────────────────────────────────────
// This is sent to SMTP_USER (the pharmacy email) when a new order is placed.
// No third-party needed — uses your existing Gmail/SMTP setup.
export const sendPharmacistOrderAlert = async (order, customer) => {
  const pharmacistEmail = process.env.PHARMACIST_EMAIL || process.env.SMTP_USER;
  if (!pharmacistEmail) return;

  const items = order.items || [];
  const itemRows = items.map((item) => `
    <tr>
      <td>${item.productName}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:right">₦${Number(item.price).toLocaleString()}</td>
      <td style="text-align:right">₦${Number(item.total).toLocaleString()}</td>
    </tr>`).join('');

  const html = baseTemplate(`
    <h2>🛒 New Order Received!</h2>
    <span class="badge">Order #${order.orderNumber}</span>

    <table style="margin-top:12px">
      <tr><td><strong>Customer</strong></td><td>${customer?.fullname || 'N/A'}</td></tr>
      <tr><td><strong>Email</strong></td><td>${customer?.email || 'N/A'}</td></tr>
      <tr><td><strong>Phone</strong></td><td>${order.deliveryPhone || customer?.phone || 'N/A'}</td></tr>
      <tr><td><strong>Address</strong></td><td>${order.deliveryAddress || 'N/A'}</td></tr>
      ${order.deliveryInstructions
        ? `<tr><td><strong>Instructions</strong></td><td>${order.deliveryInstructions}</td></tr>`
        : ''}
    </table>

    <table>
      <thead>
        <tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr>
      </thead>
      <tbody>
        ${itemRows}
        <tr><td colspan="3">Delivery Fee</td><td style="text-align:right">₦${Number(order.deliveryFee || 500).toLocaleString()}</td></tr>
        ${Number(order.discount) > 0
          ? `<tr><td colspan="3">Discount (${order.promoCode})</td><td style="text-align:right;color:#0090CC">-₦${Number(order.discount).toLocaleString()}</td></tr>`
          : ''}
        <tr class="total-row">
          <td colspan="3">ORDER TOTAL</td>
          <td style="text-align:right">₦${Number(order.total).toLocaleString()}</td>
        </tr>
      </tbody>
    </table>

    <div class="alert">Payment status: <strong>${order.paymentStatus?.toUpperCase() || 'UNPAID'}</strong> — awaiting payment confirmation.</div>
    <p style="color:#8A93B2;font-size:12px">Order placed at ${new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}</p>
  `);

  await transporter.sendMail({
    from: FROM_ADDRESS,
    to: pharmacistEmail,
    subject: `🛒 NEW ORDER #${order.orderNumber} — ₦${Number(order.total).toLocaleString()} | Jibam Pharmacy`,
    html,
  });
};

// ─── Pharmacist payment confirmed alert ──────────────────────────────────────
export const sendPharmacistPaymentAlert = async (order, customer, channel) => {
  const pharmacistEmail = process.env.PHARMACIST_EMAIL || process.env.SMTP_USER;
  if (!pharmacistEmail) return;

  const html = baseTemplate(`
    <h2>✅ Payment Confirmed!</h2>
    <span class="badge">Order #${order.orderNumber}</span>

    <table style="margin-top:12px">
      <tr><td><strong>Customer</strong></td><td>${customer?.fullname || 'N/A'}</td></tr>
      <tr><td><strong>Phone</strong></td><td>${order.deliveryPhone || customer?.phone || 'N/A'}</td></tr>
      <tr><td><strong>Address</strong></td><td>${order.deliveryAddress || 'N/A'}</td></tr>
      <tr><td><strong>Amount Paid</strong></td><td><strong style="color:${NAVY}">₦${Number(order.total).toLocaleString()}</strong></td></tr>
      <tr><td><strong>Channel</strong></td><td>${channel || 'Paystack'}</td></tr>
    </table>

    <div class="alert">This order is now <strong>PAID</strong>. Please process and dispatch.</div>
  `);

  await transporter.sendMail({
    from: FROM_ADDRESS,
    to: pharmacistEmail,
    subject: `✅ PAYMENT CONFIRMED — Order #${order.orderNumber} | ₦${Number(order.total).toLocaleString()}`,
    html,
  });
};
