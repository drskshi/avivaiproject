/**
 * Email verification helpers (unit-tested).
 */
const crypto = require('crypto');

const OTP_TTL_MS = 15 * 60 * 1000; // 15 minutes

function generateOtp() {
  return String(crypto.randomInt(100000, 999999));
}

function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

function buildVerificationPayload() {
  return {
    otp: generateOtp(),
    token: generateVerificationToken(),
    expires: new Date(Date.now() + OTP_TTL_MS),
  };
}

/**
 * Login gate: registered (non-guest) users must have emailVerified === true.
 * Guests skip verification (they buy with email only).
 */
function canLogin(user) {
  if (!user) {
    return { allowed: false, code: 'INVALID', message: 'Invalid email or password.' };
  }
  if (user.isGuest) {
    return {
      allowed: false,
      code: 'GUEST',
      message: 'Guest accounts cannot log in with a password. Continue as guest or register.',
    };
  }
  if (!user.emailVerified) {
    return {
      allowed: false,
      code: 'UNVERIFIED',
      message: 'Please verify your email before logging in. Check your inbox for the OTP/link, or resend verification.',
    };
  }
  return { allowed: true, code: 'OK', message: null };
}

function isOtpValid(user, otp) {
  if (!user || !user.verificationOtp || !user.verificationExpires) return false;
  if (new Date() > new Date(user.verificationExpires)) return false;
  return String(user.verificationOtp) === String(otp).trim();
}

function isTokenValid(user, token) {
  if (!user || !user.verificationToken || !user.verificationExpires) return false;
  if (new Date() > new Date(user.verificationExpires)) return false;
  return String(user.verificationToken) === String(token).trim();
}

function isResetOtpValid(user, otp) {
  if (!user || !user.resetOtp || !user.resetExpires) return false;
  if (new Date() > new Date(user.resetExpires)) return false;
  return String(user.resetOtp) === String(otp).trim();
}

function isResetTokenValid(user, token) {
  if (!user || !user.resetToken || !user.resetExpires) return false;
  if (new Date() > new Date(user.resetExpires)) return false;
  return String(user.resetToken) === String(token).trim();
}

module.exports = {
  OTP_TTL_MS,
  generateOtp,
  generateVerificationToken,
  buildVerificationPayload,
  canLogin,
  isOtpValid,
  isTokenValid,
  isResetOtpValid,
  isResetTokenValid,
};
