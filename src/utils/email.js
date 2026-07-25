import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const emailTemplate = (title, content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; }
    .header { background: #2E7D32; padding: 30px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 24px; }
    .body { padding: 30px; color: #333; line-height: 1.6; }
    .footer { background: #f4f4f4; padding: 20px; text-align: center; color: #888; font-size: 12px; }
    .btn { display: inline-block; background: #2E7D32; color: #fff; padding: 12px 30px; border-radius: 8px; text-decoration: none; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>🏥 Jibam Pharmacy</h1></div>
    <div class="body">
      <h2>${title}</h2>
      ${content}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Jibam Pharmacy. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

export const sendWelcomeEmail = async (user) => {
  const html = emailTemplate(
    `Welcome, ${user.fullname}!`,
    `<p>Thank you for joining Jibam Pharmacy. Your account has been created successfully.</p>
     <p>Start shopping for quality medicines delivered to your doorstep.</p>`
  );
  await transporter.sendMail({
    from: `"Jibam Pharmacy" <${process.env.SMTP_USER}>`,
    to: user.email,
    subject: 'Welcome to Jibam Pharmacy',
    html,
  });
};

export const sendPasswordResetEmail = async (user, resetUrl) => {
  const html = emailTemplate(
    'Password Reset Request',
    `<p>Hi ${user.fullname},</p>
     <p>You requested a password reset. Click the button below to reset your password. This link expires in 1 hour.</p>
     <a class="btn" href="${resetUrl}">Reset Password</a>
     <p>If you did not request this, please ignore this email.</p>`
  );
  await transporter.sendMail({
    from: `"Jibam Pharmacy" <${process.env.SMTP_USER}>`,
    to: user.email,
    subject: 'Password Reset — Jibam Pharmacy',
    html,
  });
};

export const sendOrderConfirmationEmail = async (user, order) => {
  const html = emailTemplate(
    'Order Confirmed! 🎉',
    `<p>Hi ${user.fullname},</p>
     <p>Your order <strong>#${order.orderNumber}</strong> has been confirmed.</p>
     <p><strong>Total:</strong> ₦${Number(order.total).toLocaleString()}</p>
     <p>We will notify you when your order is out for delivery.</p>`
  );
  await transporter.sendMail({
    from: `"Jibam Pharmacy" <${process.env.SMTP_USER}>`,
    to: user.email,
    subject: `Order Confirmed — #${order.orderNumber}`,
    html,
  });
};
