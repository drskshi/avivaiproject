/**
 * Discount rules by date range (registered users only).
 */
const mongoose = require('mongoose');

const discountSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    percentOff: { type: Number, required: true, min: 0, max: 100 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    registeredOnly: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Discount', discountSchema);
