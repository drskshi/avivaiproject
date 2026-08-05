/**
 * Email-verification gate on login (+ OTP helpers).
 */
const {
  canLogin,
  isOtpValid,
  isTokenValid,
  isResetOtpValid,
  isResetTokenValid,
  buildVerificationPayload,
} = require('../backend/utils/verification');

describe('Email verification gate on login', () => {
  test('blocks unverified registered user', () => {
    const gate = canLogin({
      isGuest: false,
      emailVerified: false,
    });
    expect(gate.allowed).toBe(false);
    expect(gate.code).toBe('UNVERIFIED');
    expect(gate.message).toMatch(/verify your email/i);
  });

  test('allows verified registered user', () => {
    const gate = canLogin({
      isGuest: false,
      emailVerified: true,
    });
    expect(gate.allowed).toBe(true);
    expect(gate.code).toBe('OK');
  });

  test('blocks guest from password login path', () => {
    const gate = canLogin({ isGuest: true, emailVerified: true });
    expect(gate.allowed).toBe(false);
    expect(gate.code).toBe('GUEST');
  });

  test('invalid user blocked', () => {
    expect(canLogin(null).allowed).toBe(false);
  });
});

describe('OTP / token validity', () => {
  test('buildVerificationPayload creates 6-digit OTP and future expiry', () => {
    const p = buildVerificationPayload();
    expect(p.otp).toMatch(/^\d{6}$/);
    expect(p.token.length).toBeGreaterThan(20);
    expect(new Date(p.expires).getTime()).toBeGreaterThan(Date.now());
  });

  test('isOtpValid accepts matching non-expired OTP', () => {
    const user = {
      verificationOtp: '123456',
      verificationExpires: new Date(Date.now() + 60000),
    };
    expect(isOtpValid(user, '123456')).toBe(true);
    expect(isOtpValid(user, '000000')).toBe(false);
  });

  test('isOtpValid rejects expired OTP', () => {
    const user = {
      verificationOtp: '123456',
      verificationExpires: new Date(Date.now() - 1000),
    };
    expect(isOtpValid(user, '123456')).toBe(false);
  });

  test('isTokenValid accepts matching token', () => {
    const user = {
      verificationToken: 'abc',
      verificationExpires: new Date(Date.now() + 60000),
    };
    expect(isTokenValid(user, 'abc')).toBe(true);
    expect(isTokenValid(user, 'nope')).toBe(false);
  });
});

describe('Forgot-password reset codes', () => {
  test('accepts valid reset OTP', () => {
    const user = {
      resetOtp: '654321',
      resetExpires: new Date(Date.now() + 60000),
    };
    expect(isResetOtpValid(user, '654321')).toBe(true);
    expect(isResetOtpValid(user, '111111')).toBe(false);
  });

  test('rejects expired reset token', () => {
    const user = {
      resetToken: 'reset-abc',
      resetExpires: new Date(Date.now() - 1000),
    };
    expect(isResetTokenValid(user, 'reset-abc')).toBe(false);
  });

  test('accepts valid reset token', () => {
    const user = {
      resetToken: 'reset-abc',
      resetExpires: new Date(Date.now() + 60000),
    };
    expect(isResetTokenValid(user, 'reset-abc')).toBe(true);
  });
});
