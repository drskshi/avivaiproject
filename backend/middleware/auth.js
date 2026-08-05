/**
 * JWT authentication + role-based access control.
 */
const jwt = require('jsonwebtoken');
const User = require('../models/User');

function signToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
      isGuest: !!user.isGuest,
      email: user.email,
    },
    process.env.JWT_SECRET || 'dev_secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

async function protect(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User no longer exists.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
}

/** Optional auth — attaches user if token present */
async function optionalAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return next();
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    const user = await User.findById(decoded.id);
    if (user) req.user = user;
    next();
  } catch {
    next();
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }
  next();
}

module.exports = { signToken, protect, optionalAuth, requireAdmin };
