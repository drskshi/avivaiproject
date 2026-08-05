/**
 * User model — customers, guests, and admins.
 * Referenced by Orders and Tickets (queried independently).
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    passwordHash: {
      type: String,
      required: function requiredPassword() {
        return !this.isGuest;
      },
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: 80,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: 80,
      default: 'Guest',
    },
    dateOfBirth: {
      type: Date,
      // Optional on register (brief: name, email, password, phone).
      // Used for demographics when provided.
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 30,
      default: '',
    },
    role: {
      type: String,
      enum: ['customer', 'admin'],
      default: 'customer',
    },
    isGuest: {
      type: Boolean,
      default: false,
    },
    /** Registered users must verify before login; guests/admins seeded as verified */
    emailVerified: {
      type: Boolean,
      default: false,
    },
    verificationOtp: {
      type: String,
      default: null,
    },
    verificationToken: {
      type: String,
      default: null,
      index: true,
    },
    verificationExpires: {
      type: Date,
      default: null,
    },
    /** Forgot-password reset (OTP + link token) */
    resetOtp: {
      type: String,
      default: null,
    },
    resetToken: {
      type: String,
      default: null,
      index: true,
    },
    resetExpires: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = async function comparePassword(plain) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id,
    email: this.email,
    firstName: this.firstName,
    lastName: this.lastName,
    dateOfBirth: this.dateOfBirth,
    phone: this.phone,
    role: this.role,
    isGuest: this.isGuest,
    emailVerified: this.emailVerified,
    createdAt: this.createdAt,
  };
};

userSchema.statics.hashPassword = async function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
};

module.exports = mongoose.model('User', userSchema);
