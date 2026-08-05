/**
 * TicketType — catalogue + inventory.
 * Own collection so remainingStock can be updated atomically.
 */
const mongoose = require('mongoose');

const ticketTypeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      enum: ['RESTRICTED', 'STANDARD', 'VIP', 'GROUP_STANDARD'],
    },
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    maxAttendees: { type: Number, required: true, min: 1, max: 5 },
    isRefundable: { type: Boolean, required: true },
    isAmendable: { type: Boolean, required: true },
    totalStock: { type: Number, required: true, min: 0 },
    remainingStock: { type: Number, required: true, min: 0 },
    description: { type: String, default: '' },
  },
  { timestamps: true }
);

/**
 * Atomically reserve `qty` tickets if stock allows.
 * Returns updated doc or null if insufficient stock (prevents overbooking).
 */
ticketTypeSchema.statics.reserveStock = async function reserveStock(code, qty) {
  return this.findOneAndUpdate(
    { code, remainingStock: { $gte: qty } },
    { $inc: { remainingStock: -qty } },
    { returnDocument: 'after' }
  );
};

/** Restore stock after cancellation */
ticketTypeSchema.statics.releaseStock = async function releaseStock(code, qty) {
  return this.findOneAndUpdate(
    { code },
    { $inc: { remainingStock: qty } },
    { returnDocument: 'after' }
  );
};

module.exports = mongoose.model('TicketType', ticketTypeSchema);
