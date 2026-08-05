const Ticket = require('../models/Ticket');
const TicketType = require('../models/TicketType');
const { asyncHandler } = require('../middleware/errorHandler');
const { calculateRefundAmount, calculateAmendment } = require('../utils/pricing');
const { generateTicketQr } = require('../utils/qr');

/**
 * GET /api/tickets/mine
 */
const myTickets = asyncHandler(async (req, res) => {
  const tickets = await Ticket.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .populate('ticketType')
    .lean();
  res.json({ success: true, tickets });
});

/**
 * GET /api/tickets/:id
 */
const getTicket = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findById(req.params.id).populate('ticketType');
  if (!ticket) {
    return res.status(404).json({ success: false, message: 'Ticket not found.' });
  }
  if (ticket.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Not authorised.' });
  }
  res.json({ success: true, ticket });
});

/**
 * POST /api/tickets/:id/cancel
 */
const cancelTicket = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findById(req.params.id).populate('ticketType');
  if (!ticket) {
    return res.status(404).json({ success: false, message: 'Ticket not found.' });
  }

  const isOwner = ticket.user.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'admin';
  if (!isOwner && !isAdmin) {
    return res.status(403).json({ success: false, message: 'Not authorised.' });
  }
  if (ticket.status === 'cancelled') {
    return res.status(400).json({ success: false, message: 'Ticket already cancelled.' });
  }

  const type = ticket.ticketType;
  // Admins may force-cancel without refund eligibility; customers must pass rules
  let refundResult = { allowed: false, refundAmount: 0, reason: null };

  if (isAdmin && req.body.force) {
    refundResult = {
      allowed: type.isRefundable && !ticket.isGuestPurchase,
      refundAmount:
        type.isRefundable && !ticket.isGuestPurchase
          ? Math.round(ticket.amountPaid * 0.8 * 100) / 100
          : 0,
      reason: null,
    };
  } else {
    refundResult = calculateRefundAmount(ticket.amountPaid, {
      isRefundable: type.isRefundable,
      isGuestPurchase: ticket.isGuestPurchase,
    });
    if (!refundResult.allowed) {
      return res.status(400).json({ success: false, message: refundResult.reason });
    }
  }

  ticket.status = 'cancelled';
  ticket.cancelledAt = new Date();
  ticket.refundAmount = refundResult.refundAmount || 0;
  await ticket.save();

  await TicketType.releaseStock(ticket.ticketTypeCode, 1);

  res.json({
    success: true,
    message:
      ticket.refundAmount > 0
        ? `Ticket cancelled. Refund of £${ticket.refundAmount.toFixed(2)} (20% fee applied).`
        : 'Ticket cancelled. No refund applicable.',
    ticket,
  });
});

/**
 * POST /api/tickets/:id/amend — upgrade only
 * Body: { newTicketTypeCode }
 */
const amendTicket = asyncHandler(async (req, res) => {
  const { newTicketTypeCode } = req.body;
  if (!newTicketTypeCode) {
    return res.status(400).json({ success: false, message: 'newTicketTypeCode is required.' });
  }

  const ticket = await Ticket.findById(req.params.id).populate('ticketType');
  if (!ticket) {
    return res.status(404).json({ success: false, message: 'Ticket not found.' });
  }

  const isOwner = ticket.user.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'admin';
  if (!isOwner && !isAdmin) {
    return res.status(403).json({ success: false, message: 'Not authorised.' });
  }
  if (ticket.status === 'cancelled') {
    return res.status(400).json({ success: false, message: 'Cancelled tickets cannot be amended.' });
  }

  const currentType = ticket.ticketType;
  // Customers cannot amend non-amendable types; admins can
  if (!isAdmin && !currentType.isAmendable) {
    return res.status(400).json({
      success: false,
      message: 'This ticket type is non-amendable.',
    });
  }

  const newType = await TicketType.findOne({ code: newTicketTypeCode });
  if (!newType) {
    return res.status(404).json({ success: false, message: 'Target ticket type not found.' });
  }

  const amendment = calculateAmendment(
    ticket.ticketTypeCode,
    newType.code,
    ticket.originalPrice,
    newType.price
  );
  if (!amendment.allowed) {
    return res.status(400).json({ success: false, message: amendment.reason });
  }

  // Reserve new stock, release old
  const reserved = await TicketType.reserveStock(newType.code, 1);
  if (!reserved) {
    return res.status(409).json({
      success: false,
      message: `${newType.name} is sold out. Upgrade not possible.`,
    });
  }
  await TicketType.releaseStock(ticket.ticketTypeCode, 1);

  const fromCode = ticket.ticketTypeCode;
  ticket.amendmentHistory.push({
    fromType: fromCode,
    toType: newType.code,
    feePaid: amendment.fee,
    at: new Date(),
    by: req.user._id,
    note: isAdmin ? 'Amended by admin' : 'Customer upgrade',
  });
  ticket.ticketType = newType._id;
  ticket.ticketTypeCode = newType.code;
  ticket.originalPrice = newType.price;
  ticket.amountPaid = Math.round((ticket.amountPaid + amendment.fee) * 100) / 100;
  ticket.status = 'amended';
  // Keep same ticket number + refresh QR (same payload)
  ticket.qrDataUrl = await generateTicketQr(ticket.ticketNumber);
  await ticket.save();

  res.json({
    success: true,
    message: `Upgraded ${fromCode} → ${newType.code}. Amendment fee: £${amendment.fee.toFixed(2)}.`,
    amendmentFee: amendment.fee,
    ticket,
  });
});

module.exports = { myTickets, getTicket, cancelTicket, amendTicket };
