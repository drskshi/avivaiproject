const Order = require('../models/Order');
const Ticket = require('../models/Ticket');
const TicketType = require('../models/TicketType');
const Payment = require('../models/Payment');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  isChild,
  getDiscountPercentForDate,
  applyDiscount,
  validateAccompaniedChildren,
  salesHaveStarted,
} = require('../utils/pricing');
const { generateTicketNumber } = require('../utils/ticketNumber');
const { generateTicketQr } = require('../utils/qr');
const { sendTicketEmail } = require('../utils/email');
const { randomUUID } = require('crypto');

/**
 * Build normalised attendees + child flags; validate group sizes.
 */
function normaliseItems(rawItems, typeMap) {
  const errors = [];
  const items = [];

  for (const raw of rawItems || []) {
    const type = typeMap.get(raw.ticketTypeCode);
    if (!type) {
      errors.push(`Unknown ticket type: ${raw.ticketTypeCode}`);
      continue;
    }

    const attendees = (raw.attendees || []).map((a) => {
      const dob = new Date(a.dateOfBirth);
      return {
        firstName: a.firstName,
        lastName: a.lastName,
        dateOfBirth: dob,
        isChild: isChild(dob),
      };
    });

    if (attendees.length === 0) {
      errors.push(`${type.name}: at least one attendee is required.`);
      continue;
    }
    if (attendees.length > type.maxAttendees) {
      errors.push(`${type.name}: max ${type.maxAttendees} attendee(s).`);
      continue;
    }
    // Single tickets: exactly 1 attendee; group: 1–5 under flat price
    if (type.code !== 'GROUP_STANDARD' && attendees.length !== 1) {
      errors.push(`${type.name}: exactly one attendee required.`);
      continue;
    }
    if (type.code === 'GROUP_STANDARD' && attendees.length < 1) {
      errors.push('Group Standard needs between 1 and 5 attendees.');
      continue;
    }

    // Each single/group ticket purchase = 1 inventory unit
    items.push({
      ticketType: type._id,
      ticketTypeCode: type.code,
      quantity: 1,
      unitPrice: type.price,
      attendees,
      _typeDoc: type,
    });
  }

  return { items, errors };
}

/**
 * POST /api/orders — create pending order (reserves nothing until payment)
 * Body: { items: [{ ticketTypeCode, attendees: [...] }] }
 */
const createOrder = asyncHandler(async (req, res) => {
  if (!salesHaveStarted()) {
    return res.status(403).json({
      success: false,
      message: 'Ticket sales have not started yet (opens 1 July 2026).',
    });
  }

  const types = await TicketType.find();
  const typeMap = new Map(types.map((t) => [t.code, t]));
  const { items, errors } = normaliseItems(req.body.items, typeMap);
  if (errors.length) {
    return res.status(400).json({ success: false, message: errors.join(' ') });
  }
  if (!items.length) {
    return res.status(400).json({ success: false, message: 'Cart is empty.' });
  }

  const allAttendees = items.flatMap((i) => i.attendees);
  const childCheck = validateAccompaniedChildren(allAttendees);
  if (!childCheck.ok) {
    return res.status(400).json({ success: false, message: childCheck.message });
  }

  // Stock availability check (soft — hard reserve at payment)
  for (const item of items) {
    if (item._typeDoc.remainingStock < 1) {
      return res.status(409).json({
        success: false,
        message: `${item._typeDoc.name} is sold out.`,
      });
    }
  }

  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const isRegistered = !req.user.isGuest && !!req.user.emailVerified;
  const discountPercent = getDiscountPercentForDate(new Date(), isRegistered);
  const { discountAmount, total } = applyDiscount(subtotal, discountPercent);

  const order = await Order.create({
    user: req.user._id,
    status: 'pending',
    items: items.map(({ _typeDoc, ...rest }) => rest),
    subtotal,
    discountPercent,
    discountAmount,
    totalPaid: total,
    isGuestCheckout: !!req.user.isGuest,
  });

  res.status(201).json({ success: true, order });
});

/**
 * POST /api/orders/:id/pay — simulate card payment, mint tickets, email
 * Body: { cardHolder, simulateFail? } — no real card data stored
 */
const payOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found.' });
  }
  if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Not authorised for this order.' });
  }
  if (order.status !== 'pending') {
    return res.status(400).json({ success: false, message: 'Order is not awaiting payment.' });
  }

  if (req.body.simulateFail) {
    const failed = await Payment.create({
      order: order._id,
      user: req.user._id,
      amount: order.totalPaid,
      status: 'simulated_failed',
      transactionRef: `FAIL-${randomUUID()}`,
      cardBrandLast4Masked: '**** 0000',
    });
    return res.status(402).json({
      success: false,
      message: 'Simulated payment failed. Please try again.',
      payment: failed,
    });
  }

  // Atomic stock reservation per line item
  const reserved = [];
  try {
    for (const item of order.items) {
      const updated = await TicketType.reserveStock(item.ticketTypeCode, item.quantity);
      if (!updated) {
        // roll back previous reservations
        for (const r of reserved) {
          await TicketType.releaseStock(r.code, r.qty);
        }
        return res.status(409).json({
          success: false,
          message: `Not enough stock for ${item.ticketTypeCode}. Overbooking prevented.`,
        });
      }
      reserved.push({ code: item.ticketTypeCode, qty: item.quantity });
    }
  } catch (err) {
    for (const r of reserved) {
      await TicketType.releaseStock(r.code, r.qty);
    }
    throw err;
  }

  const payment = await Payment.create({
    order: order._id,
    user: req.user._id,
    amount: order.totalPaid,
    status: 'simulated_success',
    transactionRef: `TXN-${randomUUID()}`,
    cardBrandLast4Masked: '**** 4242',
  });

  const purchaseDate = new Date();
  const tickets = [];
  const emailPreviews = [];

  // Allocate paid amount proportionally across tickets for refund math
  const subtotal = order.subtotal || 1;
  for (const item of order.items) {
    const share = (item.unitPrice / subtotal) * order.totalPaid;
    const amountPaid = Math.round(share * 100) / 100;
    const ticketNumber = generateTicketNumber();
    const qrDataUrl = await generateTicketQr(ticketNumber);

    const ticket = await Ticket.create({
      ticketNumber,
      qrDataUrl,
      order: order._id,
      user: order.user,
      ticketType: item.ticketType,
      ticketTypeCode: item.ticketTypeCode,
      attendees: item.attendees,
      originalPrice: item.unitPrice,
      amountPaid,
      status: 'valid',
      purchaseDate,
      isGuestPurchase: order.isGuestCheckout,
    });
    tickets.push(ticket);

    const typeDoc = await TicketType.findById(item.ticketType).lean();
    const typeName = typeDoc?.name || item.ticketTypeCode;
    const mail = await sendTicketEmail({
      to: req.user.email,
      ticketNumber,
      ticketTypeName: typeName,
      purchaseDate,
      amountPaid,
      attendees: item.attendees,
      qrDataUrl,
    });
    if (mail?.previewUrl) emailPreviews.push(mail.previewUrl);
  }

  order.status = 'paid';
  order.payment = payment._id;
  await order.save();

  res.json({
    success: true,
    message: 'Payment successful. Tickets generated and confirmation emailed.',
    order,
    payment,
    tickets,
    emailPreviewUrls: emailPreviews,
  });
});

/**
 * GET /api/orders/mine
 */
const myOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .populate('payment')
    .lean();
  res.json({ success: true, orders });
});

/**
 * GET /api/orders/:id
 */
const getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate('payment');
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found.' });
  }
  if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Not authorised.' });
  }
  const tickets = await Ticket.find({ order: order._id });
  res.json({ success: true, order, tickets });
});

module.exports = { createOrder, payOrder, myOrders, getOrder };
