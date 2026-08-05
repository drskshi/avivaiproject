/**
 * Nodemailer mailer.
 * 1) Uses real SMTP from .env when SMTP_HOST/USER/PASS are set.
 * 2) Otherwise auto-creates an Ethereal test account and returns a
 *    preview URL (open in browser to "receive" the email).
 */
const nodemailer = require('nodemailer');
const content = require('../config/content');

let smtpTransporter = null;
let etherealTransporterPromise = null;
let lastPreviewUrl = null;

function smtpConfigured() {
  return !!(
    process.env.SMTP_HOST &&
    String(process.env.SMTP_HOST).trim() &&
    process.env.SMTP_USER &&
    String(process.env.SMTP_USER).trim() &&
    process.env.SMTP_PASS &&
    String(process.env.SMTP_PASS).trim()
  );
}

async function getTransporter() {
  if (smtpConfigured()) {
    if (!smtpTransporter) {
      const port = Number(process.env.SMTP_PORT || 587);
      smtpTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST.trim(),
        port,
        secure: port === 465,
        auth: {
          user: process.env.SMTP_USER.trim(),
          pass: process.env.SMTP_PASS.trim(),
        },
      });
      console.log(`[email] Using real SMTP: ${process.env.SMTP_HOST}:${port}`);
    }
    return { transporter: smtpTransporter, mode: 'smtp' };
  }

  // Auto Ethereal so demo works without Gmail/SMTP setup
  if (!etherealTransporterPromise) {
    etherealTransporterPromise = (async () => {
      const account = await nodemailer.createTestAccount();
      console.log('[email] SMTP not set — using Ethereal test inbox');
      console.log(`[email] Ethereal user: ${account.user}`);
      const transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: account.user, pass: account.pass },
      });
      return transporter;
    })();
  }

  return { transporter: await etherealTransporterPromise, mode: 'ethereal' };
}

function fromAddress() {
  if (smtpConfigured() && process.env.SMTP_FROM) return process.env.SMTP_FROM;
  if (smtpConfigured() && process.env.SMTP_USER) return process.env.SMTP_USER;
  return `"${content.brandName}" <noreply@o2tickets.local>`;
}

function getLastPreviewUrl() {
  return lastPreviewUrl;
}

async function sendMail({ to, subject, text, html, attachments }) {
  const payload = {
    from: fromAddress(),
    to,
    subject,
    text,
    html,
    attachments,
  };

  console.log('\n========== OUTGOING EMAIL ==========');
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(text);
  console.log('====================================\n');

  try {
    const { transporter, mode } = await getTransporter();
    const info = await transporter.sendMail(payload);
    const previewUrl = nodemailer.getTestMessageUrl(info) || null;
    lastPreviewUrl = previewUrl;

    if (previewUrl) {
      console.log('[email] 📬 Open this link to view the email:');
      console.log(previewUrl);
    } else {
      console.log('[email] Sent via SMTP:', info.messageId);
    }

    return {
      delivered: true,
      mode,
      to,
      messageId: info.messageId,
      previewUrl,
    };
  } catch (err) {
    console.error('[email] FAILED to send:', err.message);
    lastPreviewUrl = null;
    return {
      delivered: false,
      mode: 'failed',
      to,
      error: err.message,
      previewUrl: null,
    };
  }
}

async function sendVerificationEmail({ to, firstName, otp, token }) {
  const base = (process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
  const verifyUrl = `${base}/pages/verify.html?email=${encodeURIComponent(to)}&token=${encodeURIComponent(token)}`;

  const subject = content.emails.verifySubject;
  const text = [
    `Hi ${firstName || 'there'},`,
    '',
    `Your verification code is: ${otp}`,
    'This code expires in 15 minutes.',
    '',
    `Or open this link: ${verifyUrl}`,
    '',
    `— ${content.brandName}`,
  ].join('\n');

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;color:#0b1c2c">
      <h1 style="color:#e11d48;font-size:22px">${content.brandName}</h1>
      <p>Hi ${firstName || 'there'},</p>
      <p>Enter this code to verify your email:</p>
      <p style="font-size:32px;letter-spacing:8px;font-weight:800;background:#f8fafc;padding:16px;text-align:center;border-radius:12px">${otp}</p>
      <p style="color:#64748b;font-size:14px">Expires in 15 minutes.</p>
      <p><a href="${verifyUrl}" style="display:inline-block;background:#e11d48;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700">Verify email</a></p>
      <p style="font-size:12px;color:#94a3b8;word-break:break-all">${verifyUrl}</p>
    </div>
  `;

  return sendMail({ to, subject, text, html });
}

async function sendTicketEmail(payload) {
  const {
    to,
    ticketNumber,
    ticketTypeName,
    purchaseDate,
    amountPaid,
    attendees,
    qrDataUrl,
  } = payload;

  const names = (attendees || [])
    .map((a) => `${a.firstName} ${a.lastName}`)
    .join(', ');

  const subject = `${content.emails.ticketSubjectPrefix} — ${ticketNumber}`;
  const purchased = new Date(purchaseDate).toUTCString();
  const amount = `£${Number(amountPaid).toFixed(2)}`;

  const text = [
    'Thank you for your purchase!',
    '',
    `Ticket number: ${ticketNumber}`,
    `Ticket type: ${ticketTypeName}`,
    `Purchase date: ${purchased}`,
    `Amount paid: ${amount}`,
    `Attendees: ${names}`,
    '',
    'Present the QR code at the venue (see HTML email for image).',
    `— ${content.brandName}`,
  ].join('\n');

  const base64 = (qrDataUrl || '').replace(/^data:image\/\w+;base64,/, '');
  const attachments = base64
    ? [
        {
          filename: `${ticketNumber}.png`,
          content: Buffer.from(base64, 'base64'),
          cid: 'ticketqr',
          contentType: 'image/png',
        },
      ]
    : [];

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0b1c2c">
      <h1 style="color:#e11d48;font-size:22px">${content.brandName}</h1>
      <p>Thank you for your purchase for <strong>${content.event.artist}</strong> at ${content.event.venue}.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:8px 0;color:#64748b">Ticket number</td><td style="padding:8px 0;font-weight:700;font-family:monospace">${ticketNumber}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Ticket type</td><td style="padding:8px 0;font-weight:700">${ticketTypeName}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Purchase date</td><td style="padding:8px 0">${purchased}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Amount paid</td><td style="padding:8px 0;font-weight:700">${amount}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Attendees</td><td style="padding:8px 0">${names}</td></tr>
      </table>
      <p style="font-weight:700">Your entry QR code</p>
      <img src="cid:ticketqr" alt="Ticket QR code" width="220" height="220" style="display:block;border:1px solid #e2e8f0;border-radius:12px" />
      <p style="font-size:12px;color:#94a3b8;margin-top:24px">Simulated card payment — assignment demo. Keep this email for entry.</p>
    </div>
  `;

  return sendMail({ to, subject, text, html, attachments });
}

async function sendPasswordResetEmail({ to, firstName, otp, token }) {
  const base = (process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
  const resetUrl = `${base}/pages/reset-password.html?email=${encodeURIComponent(to)}&token=${encodeURIComponent(token)}`;

  const subject = content.emails.resetSubject;
  const text = [
    `Hi ${firstName || 'there'},`,
    '',
    `Your password reset code is: ${otp}`,
    'This code expires in 15 minutes.',
    '',
    `Or open this link: ${resetUrl}`,
    '',
    'If you did not request this, you can ignore this email.',
    `— ${content.brandName}`,
  ].join('\n');

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;color:#0b1c2c">
      <h1 style="color:#e11d48;font-size:22px">${content.brandName}</h1>
      <p>Hi ${firstName || 'there'},</p>
      <p>Use this code to reset your password:</p>
      <p style="font-size:32px;letter-spacing:8px;font-weight:800;background:#f8fafc;padding:16px;text-align:center;border-radius:12px">${otp}</p>
      <p style="color:#64748b;font-size:14px">Expires in 15 minutes.</p>
      <p><a href="${resetUrl}" style="display:inline-block;background:#0b1c2c;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700">Reset password</a></p>
      <p style="font-size:12px;color:#94a3b8;word-break:break-all">${resetUrl}</p>
    </div>
  `;

  return sendMail({ to, subject, text, html });
}

module.exports = {
  smtpConfigured,
  sendMail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendTicketEmail,
  getLastPreviewUrl,
};
