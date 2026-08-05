/**
 * Permanently delete a user and cascade-related MongoDB documents.
 * Removes: Tickets (releases remaining inventory for active tickets),
 * Payments, Orders, then the User.
 */
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const TicketType = require('../models/TicketType');

async function deleteUserAndRelatedData(userId, { actorId = null, allowSelf = true } = {}) {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found.');
    err.statusCode = 404;
    throw err;
  }

  if (!allowSelf && actorId && user._id.toString() === actorId.toString()) {
    const err = new Error('You cannot delete your own account from this action.');
    err.statusCode = 400;
    throw err;
  }

  // Keep at least one admin in the system
  if (user.role === 'admin') {
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount <= 1) {
      const err = new Error('Cannot delete the last admin account.');
      err.statusCode = 400;
      throw err;
    }
  }

  const tickets = await Ticket.find({ user: user._id });
  for (const ticket of tickets) {
    // Return inventory for tickets that still occupy a seat
    if (['valid', 'amended', 'used'].includes(ticket.status)) {
      await TicketType.releaseStock(ticket.ticketTypeCode, 1);
    }
  }

  const orders = await Order.find({ user: user._id }).select('_id');
  const orderIds = orders.map((o) => o._id);

  await Payment.deleteMany({
    $or: [{ user: user._id }, { order: { $in: orderIds } }],
  });
  await Ticket.deleteMany({ user: user._id });
  await Order.deleteMany({ user: user._id });
  await User.deleteOne({ _id: user._id });

  return {
    deletedUserId: user._id.toString(),
    email: user.email,
    deleted: {
      tickets: tickets.length,
      orders: orderIds.length,
    },
  };
}

module.exports = { deleteUserAndRelatedData };
