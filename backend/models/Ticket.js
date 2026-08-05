/**
 * Ticket — one scannable ticket per purchase unit.
 * QR encodes ticketNumber for admin lookup.
 */
const mongoose = require('mongoose');

const attendeeSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    dateOfBirth: { type: Date, required: true },
    isChild: { type: Boolean, default: false },
  },
  { _id: false }
);

const amendmentSchema = new mongoose.Schema(
  {
    fromType: { type: String, required: true },
    toType: { type: String, required: true },
    feePaid: { type: Number, required: true, min: 0 },
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: { type: String, default: '' },
  },
  { _id: false }
);

const ticketSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    qrDataUrl: { type: String, required: true },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    ticketType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TicketType',
      required: true,
    },
    ticketTypeCode: {
      type: String,
      enum: ['RESTRICTED', 'STANDARD', 'VIP', 'GROUP_STANDARD'],
      required: true,
    },
    attendees: { type: [attendeeSchema], required: true },
    originalPrice: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['valid', 'cancelled', 'amended', 'used'],
      default: 'valid',
      index: true,
    },
    purchaseDate: { type: Date, required: true },
    isGuestPurchase: { type: Boolean, default: false },
    refundAmount: { type: Number, default: 0 },
    cancelledAt: { type: Date, default: null },
    amendmentHistory: { type: [amendmentSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Ticket', ticketSchema);
