/**
 * Order — checkout cart snapshot.
 * Line items + attendees are embedded (always loaded with the order).
 * Tickets are separate documents linked by reference after payment.
 */
const mongoose = require('mongoose');

const attendeeSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 80 },
    lastName: { type: String, required: true, trim: true, maxlength: 80 },
    dateOfBirth: { type: Date, required: true },
    isChild: { type: Boolean, default: false },
  },
  { _id: false }
);

const orderItemSchema = new mongoose.Schema(
  {
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
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    attendees: {
      type: [attendeeSchema],
      validate: {
        validator(arr) {
          return Array.isArray(arr) && arr.length > 0;
        },
        message: 'Each order item needs at least one attendee',
      },
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'cancelled', 'refunded', 'amended'],
      default: 'pending',
    },
    items: {
      type: [orderItemSchema],
      validate: {
        validator(arr) {
          return Array.isArray(arr) && arr.length > 0;
        },
        message: 'Order must contain at least one item',
      },
    },
    subtotal: { type: Number, required: true, min: 0 },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    discountAmount: { type: Number, default: 0, min: 0 },
    totalPaid: { type: Number, required: true, min: 0 },
    isGuestCheckout: { type: Boolean, default: false },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
