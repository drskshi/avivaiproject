/**
 * Simulated card payment — no real PAN/CVV stored.
 */
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      unique: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, enum: ['card'], default: 'card' },
    status: {
      type: String,
      enum: ['simulated_success', 'simulated_failed'],
      required: true,
    },
    /** Display-only mask, e.g. **** 4242 — never a real card number */
    cardBrandLast4Masked: { type: String, default: '**** 4242' },
    transactionRef: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
