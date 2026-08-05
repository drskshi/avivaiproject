const express = require('express');
const {
  register,
  login,
  guest,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  me,
  deleteMyAccount,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/guest', guest);
router.post('/verify', verifyEmail);
router.post('/resend-verification', resendVerification);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', protect, me);
router.delete('/me', protect, deleteMyAccount);

module.exports = router;
