const User = require('../models/User');
const { signToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email');
const { deleteUserAndRelatedData } = require('../utils/deleteUser');
const {
  buildVerificationPayload,
  canLogin,
  isOtpValid,
  isTokenValid,
  isResetOtpValid,
  isResetTokenValid,
} = require('../utils/verification');

async function issueVerification(user) {
  const { otp, token, expires } = buildVerificationPayload();
  user.verificationOtp = otp;
  user.verificationToken = token;
  user.verificationExpires = expires;
  user.emailVerified = false;
  await user.save();
  const mail = await sendVerificationEmail({
    to: user.email,
    firstName: user.firstName,
    otp,
    token,
  });
  return { otp, token, mail };
}

/**
 * POST /api/auth/register
 * Body: firstName, lastName, email, password, phone? (DOB optional)
 * Does NOT auto-login — user must verify email first.
 */
const register = asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName, dateOfBirth, phone } = req.body;

  if (!email || !password || !firstName || !lastName) {
    return res.status(400).json({
      success: false,
      message: 'Name, email, and password are required.',
    });
  }
  if (String(password).length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 6 characters.',
    });
  }

  const normalised = email.toLowerCase().trim();
  const exists = await User.findOne({ email: normalised });
  if (exists && !exists.isGuest) {
    return res.status(409).json({ success: false, message: 'Email already registered.' });
  }

  const passwordHash = await User.hashPassword(password);
  let user;

  if (exists && exists.isGuest) {
    exists.passwordHash = passwordHash;
    exists.firstName = firstName;
    exists.lastName = lastName;
    if (dateOfBirth) exists.dateOfBirth = dateOfBirth;
    exists.phone = phone || '';
    exists.isGuest = false;
    exists.role = 'customer';
    user = exists;
  } else {
    user = new User({
      email: normalised,
      passwordHash,
      firstName,
      lastName,
      dateOfBirth: dateOfBirth || undefined,
      phone: phone || '',
      role: 'customer',
      isGuest: false,
      emailVerified: false,
    });
  }

  const issued = await issueVerification(user);

  res.status(201).json({
    success: true,
    message: 'Account created. Please verify your email with the OTP we sent before logging in.',
    email: user.email,
    requiresVerification: true,
    emailPreviewUrl: issued.mail?.previewUrl || null,
    emailMode: issued.mail?.mode || null,
    // Shown only when Ethereal is used so you can verify without SMTP
    demoOtp: issued.mail?.mode === 'ethereal' ? issued.otp : undefined,
  });
});

/**
 * POST /api/auth/login — blocked until emailVerified
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user || user.isGuest) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  const ok = await user.comparePassword(password);
  if (!ok) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  const gate = canLogin(user);
  if (!gate.allowed) {
    return res.status(403).json({
      success: false,
      code: gate.code,
      message: gate.message,
      email: user.email,
      requiresVerification: gate.code === 'UNVERIFIED',
    });
  }

  const token = signToken(user);
  res.json({ success: true, token, user: user.toSafeJSON() });
});

/**
 * POST /api/auth/guest — email required; phone optional; name optional
 */
const guest = asyncHandler(async (req, res) => {
  const { email, phone, firstName, lastName } = req.body;
  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email is required for guest checkout. Phone is optional.',
    });
  }

  const normalised = email.toLowerCase().trim();
  let user = await User.findOne({ email: normalised });

  if (user && !user.isGuest) {
    return res.status(409).json({
      success: false,
      message: 'This email belongs to a registered account. Please log in instead.',
    });
  }

  const local = normalised.split('@')[0] || 'Guest';
  const fn = (firstName && String(firstName).trim()) || 'Guest';
  const ln = (lastName && String(lastName).trim()) || local;

  if (!user) {
    user = await User.create({
      email: normalised,
      firstName: fn,
      lastName: ln,
      phone: phone || '',
      isGuest: true,
      role: 'customer',
      emailVerified: true, // guests do not need email verification to buy
    });
  } else {
    if (firstName) user.firstName = fn;
    if (lastName) user.lastName = ln;
    if (phone !== undefined) user.phone = phone || '';
    await user.save();
  }

  const token = signToken(user);
  res.status(201).json({ success: true, token, user: user.toSafeJSON() });
});

/**
 * POST /api/auth/verify — body: { email, otp? } OR { email, token? }
 */
const verifyEmail = asyncHandler(async (req, res) => {
  const { email, otp, token } = req.body;
  if (!email || (!otp && !token)) {
    return res.status(400).json({
      success: false,
      message: 'Email and either otp or token are required.',
    });
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user || user.isGuest) {
    return res.status(404).json({ success: false, message: 'Account not found.' });
  }

  if (user.emailVerified) {
    return res.json({ success: true, message: 'Email already verified. You can log in.' });
  }

  const valid = otp ? isOtpValid(user, otp) : isTokenValid(user, token);
  if (!valid) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired verification code. Please resend and try again.',
    });
  }

  user.emailVerified = true;
  user.verificationOtp = null;
  user.verificationToken = null;
  user.verificationExpires = null;
  await user.save();

  // Optional auto-login after verify
  const jwt = signToken(user);
  res.json({
    success: true,
    message: 'Email verified successfully. You are now logged in.',
    token: jwt,
    user: user.toSafeJSON(),
  });
});

/**
 * POST /api/auth/resend-verification — { email }
 */
const resendVerification = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required.' });
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  let emailPreviewUrl = null;
  let demoOtp;
  // Always return generic success to avoid email enumeration — but if found & unverified, send
  if (user && !user.isGuest && !user.emailVerified) {
    const issued = await issueVerification(user);
    emailPreviewUrl = issued.mail?.previewUrl || null;
    if (issued.mail?.mode === 'ethereal') demoOtp = issued.otp;
  }

  res.json({
    success: true,
    message: 'If that email is registered and unverified, a new verification code has been sent.',
    emailPreviewUrl,
    demoOtp,
  });
});

/**
 * POST /api/auth/forgot-password — { email }
 * Always returns a generic success message (no email enumeration).
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required.' });
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  let emailPreviewUrl = null;
  let demoOtp;
  if (user && !user.isGuest && user.passwordHash) {
    const { otp, token, expires } = buildVerificationPayload();
    user.resetOtp = otp;
    user.resetToken = token;
    user.resetExpires = expires;
    await user.save();
    const mail = await sendPasswordResetEmail({
      to: user.email,
      firstName: user.firstName,
      otp,
      token,
    });
    emailPreviewUrl = mail?.previewUrl || null;
    if (mail?.mode === 'ethereal') demoOtp = otp;
  }

  res.json({
    success: true,
    message:
      'If that email is registered, we sent a password reset code. Open the preview link below (or check your inbox if SMTP is configured).',
    emailPreviewUrl,
    demoOtp,
  });
});

/**
 * POST /api/auth/reset-password
 * Body: { email, newPassword, otp? } OR { email, newPassword, token? }
 */
const resetPassword = asyncHandler(async (req, res) => {
  const { email, newPassword, otp, token } = req.body;

  if (!email || !newPassword || (!otp && !token)) {
    return res.status(400).json({
      success: false,
      message: 'Email, new password, and either otp or token are required.',
    });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 6 characters.',
    });
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user || user.isGuest) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired reset code.',
    });
  }

  const valid = otp ? isResetOtpValid(user, otp) : isResetTokenValid(user, token);
  if (!valid) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired reset code. Request a new one.',
    });
  }

  user.passwordHash = await User.hashPassword(newPassword);
  user.resetOtp = null;
  user.resetToken = null;
  user.resetExpires = null;
  // If they could reset via email, treat email as verified
  user.emailVerified = true;
  await user.save();

  res.json({
    success: true,
    message: 'Password updated. You can log in with your new password.',
  });
});

const me = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user.toSafeJSON() });
});

/**
 * DELETE /api/auth/me — user deletes their own account + related DB data
 */
const deleteMyAccount = asyncHandler(async (req, res) => {
  const result = await deleteUserAndRelatedData(req.user._id, {
    actorId: req.user._id,
    allowSelf: true,
  });

  res.json({
    success: true,
    message: 'Your account and related data have been permanently deleted from the database.',
    ...result,
  });
});

module.exports = {
  register,
  login,
  guest,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  me,
  deleteMyAccount,
};
