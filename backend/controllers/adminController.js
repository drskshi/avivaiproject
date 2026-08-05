const User = require('../models/User');
const Ticket = require('../models/Ticket');
const TicketType = require('../models/TicketType');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Discount = require('../models/Discount');
const { asyncHandler } = require('../middleware/errorHandler');
const { ageGroupLabel } = require('../utils/pricing');
const { generateTicketQr } = require('../utils/qr');
const { deleteUserAndRelatedData } = require('../utils/deleteUser');

/**
 * GET /api/admin/tickets/lookup?q=O2-XXXX
 * Instant QR / ticket-number search
 */
const lookupTicket = asyncHandler(async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) {
    return res.status(400).json({ success: false, message: 'Query q (ticket number) is required.' });
  }

  // Accept raw ticket number or pasted QR payload (same string)
  const ticket = await Ticket.findOne({ ticketNumber: q.toUpperCase() })
    .populate('ticketType')
    .populate('user', 'email firstName lastName role isGuest')
    .populate('order');

  if (!ticket) {
    // Case-insensitive fallback
    const alt = await Ticket.findOne({
      ticketNumber: new RegExp(`^${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    })
      .populate('ticketType')
      .populate('user', 'email firstName lastName role isGuest')
      .populate('order');

    if (!alt) {
      return res.status(404).json({ success: false, message: 'No ticket found for that code.' });
    }
    return res.json({ success: true, ticket: alt });
  }

  res.json({ success: true, ticket });
});

/**
 * GET /api/admin/stats
 */
const stats = asyncHandler(async (req, res) => {
  const types = await TicketType.find().lean();
  const soldByType = await Ticket.aggregate([
    { $match: { status: { $in: ['valid', 'amended', 'used'] } } },
    { $group: { _id: '$ticketTypeCode', count: { $sum: 1 }, revenue: { $sum: '$amountPaid' } } },
  ]);

  const revenueAgg = await Payment.aggregate([
    { $match: { status: 'simulated_success' } },
    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);

  const users = await User.find({ role: 'customer' }).select('dateOfBirth isGuest').lean();
  let registered = 0;
  let guests = 0;
  const ageGroups = {
    under_16: 0,
    '16_24': 0,
    '25_39': 0,
    '40_59': 0,
    '60_plus': 0,
    unknown: 0,
  };

  for (const u of users) {
    if (u.isGuest) guests += 1;
    else registered += 1;
    if (u.dateOfBirth) {
      const label = ageGroupLabel(u.dateOfBirth);
      ageGroups[label] = (ageGroups[label] || 0) + 1;
    } else {
      ageGroups.unknown += 1;
    }
  }

  // Also derive age groups from ticket attendees (richer demographics)
  const tickets = await Ticket.find({ status: { $in: ['valid', 'amended', 'used'] } })
    .select('attendees isGuestPurchase')
    .lean();
  const attendeeAgeGroups = {
    under_16: 0,
    '16_24': 0,
    '25_39': 0,
    '40_59': 0,
    '60_plus': 0,
  };
  for (const t of tickets) {
    for (const a of t.attendees || []) {
      const label = ageGroupLabel(a.dateOfBirth);
      if (attendeeAgeGroups[label] != null) attendeeAgeGroups[label] += 1;
    }
  }

  const inventory = types.map((t) => ({
    code: t.code,
    name: t.name,
    totalStock: t.totalStock,
    remainingStock: t.remainingStock,
    sold: t.totalStock - t.remainingStock,
  }));

  res.json({
    success: true,
    stats: {
      soldByType,
      revenue: revenueAgg[0] || { total: 0, count: 0 },
      customers: { registered, guests, ratioRegistered: registered / Math.max(1, registered + guests) },
      ageGroups,
      attendeeAgeGroups,
      inventory,
      totals: {
        ticketsSold: tickets.length,
        remainingAll: types.reduce((s, t) => s + t.remainingStock, 0),
      },
    },
  });
});

/**
 * GET /api/admin/users
 */
const listUsers = asyncHandler(async (req, res) => {
  const users = await User.find().select('-passwordHash').sort({ createdAt: -1 }).lean();
  res.json({ success: true, users });
});

/**
 * PATCH /api/admin/users/:id — update role / basic fields
 */
const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  const { role, firstName, lastName, phone } = req.body;
  if (role && ['customer', 'admin'].includes(role)) user.role = role;
  if (firstName) user.firstName = firstName;
  if (lastName) user.lastName = lastName;
  if (phone !== undefined) user.phone = phone;
  await user.save();

  res.json({ success: true, user: user.toSafeJSON() });
});

/**
 * DELETE /api/admin/users/:id
 * Permanently deletes the user and related tickets/orders/payments from MongoDB.
 */
const deleteUser = asyncHandler(async (req, res) => {
  const result = await deleteUserAndRelatedData(req.params.id, {
    actorId: req.user._id,
    allowSelf: false, // admin must not wipe their own session via this route accidentally
  });

  res.json({
    success: true,
    message: `User ${result.email} deleted from the database (including related tickets/orders/payments).`,
    ...result,
  });
});

/**
 * GET /api/admin/tickets — recent tickets
 */
const listTickets = asyncHandler(async (req, res) => {
  const tickets = await Ticket.find()
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('user', 'email firstName lastName')
    .populate('ticketType', 'name code price')
    .lean();
  res.json({ success: true, tickets });
});

/**
 * GET /api/admin/orders
 */
const listOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find()
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('user', 'email firstName lastName isGuest')
    .lean();
  res.json({ success: true, orders });
});

/**
 * GET /api/admin/ticket-types — catalogue for editing
 */
const listAdminTicketTypes = asyncHandler(async (req, res) => {
  const ticketTypes = await TicketType.find().sort({ price: 1 });
  res.json({ success: true, ticketTypes });
});

/**
 * PATCH /api/admin/ticket-types/:id — edit price, stock, rules, copy
 */
const updateTicketType = asyncHandler(async (req, res) => {
  const type = await TicketType.findById(req.params.id);
  if (!type) {
    return res.status(404).json({ success: false, message: 'Ticket type not found.' });
  }

  const {
    name,
    price,
    description,
    maxAttendees,
    isRefundable,
    isAmendable,
    totalStock,
    remainingStock,
  } = req.body;

  if (name !== undefined) type.name = String(name).trim();
  if (price !== undefined) {
    const p = Number(price);
    if (Number.isNaN(p) || p < 0) {
      return res.status(400).json({ success: false, message: 'Price must be a non-negative number.' });
    }
    type.price = p;
  }
  if (description !== undefined) type.description = String(description);
  if (maxAttendees !== undefined) {
    const m = Number(maxAttendees);
    if (m < 1 || m > 5) {
      return res.status(400).json({ success: false, message: 'maxAttendees must be 1–5.' });
    }
    type.maxAttendees = m;
  }
  if (isRefundable !== undefined) type.isRefundable = !!isRefundable;
  if (isAmendable !== undefined) type.isAmendable = !!isAmendable;

  if (totalStock !== undefined) {
    const ts = Number(totalStock);
    if (Number.isNaN(ts) || ts < 0) {
      return res.status(400).json({ success: false, message: 'totalStock must be ≥ 0.' });
    }
    type.totalStock = ts;
  }
  if (remainingStock !== undefined) {
    const rs = Number(remainingStock);
    if (Number.isNaN(rs) || rs < 0) {
      return res.status(400).json({ success: false, message: 'remainingStock must be ≥ 0.' });
    }
    if (rs > type.totalStock) {
      return res.status(400).json({
        success: false,
        message: 'remainingStock cannot exceed totalStock.',
      });
    }
    type.remainingStock = rs;
  }

  await type.save();
  res.json({ success: true, message: 'Ticket type updated.', ticketType: type });
});

/**
 * GET /api/admin/discounts
 */
const listDiscounts = asyncHandler(async (req, res) => {
  const discounts = await Discount.find().sort({ startDate: 1 });
  res.json({ success: true, discounts });
});

/**
 * POST /api/admin/discounts
 */
const createDiscount = asyncHandler(async (req, res) => {
  const { name, percentOff, startDate, endDate, registeredOnly = true, isActive = true } = req.body;
  if (!name || percentOff == null || !startDate || !endDate) {
    return res.status(400).json({
      success: false,
      message: 'name, percentOff, startDate, and endDate are required.',
    });
  }
  const discount = await Discount.create({
    name,
    percentOff: Number(percentOff),
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    registeredOnly: !!registeredOnly,
    isActive: !!isActive,
  });
  res.status(201).json({ success: true, discount });
});

/**
 * PATCH /api/admin/discounts/:id
 */
const updateDiscount = asyncHandler(async (req, res) => {
  const discount = await Discount.findById(req.params.id);
  if (!discount) {
    return res.status(404).json({ success: false, message: 'Discount not found.' });
  }
  const { name, percentOff, startDate, endDate, registeredOnly, isActive } = req.body;
  if (name !== undefined) discount.name = name;
  if (percentOff !== undefined) discount.percentOff = Number(percentOff);
  if (startDate !== undefined) discount.startDate = new Date(startDate);
  if (endDate !== undefined) discount.endDate = new Date(endDate);
  if (registeredOnly !== undefined) discount.registeredOnly = !!registeredOnly;
  if (isActive !== undefined) discount.isActive = !!isActive;
  await discount.save();
  res.json({ success: true, message: 'Discount updated.', discount });
});

/**
 * DELETE /api/admin/discounts/:id
 */
const deleteDiscount = asyncHandler(async (req, res) => {
  const discount = await Discount.findByIdAndDelete(req.params.id);
  if (!discount) {
    return res.status(404).json({ success: false, message: 'Discount not found.' });
  }
  res.json({ success: true, message: 'Discount deleted.' });
});

/**
 * PATCH /api/admin/tickets/:id — edit status, attendees, amountPaid
 */
const updateTicket = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) {
    return res.status(404).json({ success: false, message: 'Ticket not found.' });
  }

  const { status, attendees, amountPaid, originalPrice } = req.body;
  if (status && ['valid', 'cancelled', 'amended', 'used'].includes(status)) {
    ticket.status = status;
  }
  if (Array.isArray(attendees) && attendees.length > 0) {
    ticket.attendees = attendees.map((a) => ({
      firstName: a.firstName,
      lastName: a.lastName,
      dateOfBirth: new Date(a.dateOfBirth),
      isChild: !!a.isChild,
    }));
  }
  if (amountPaid !== undefined) {
    const amt = Number(amountPaid);
    if (Number.isNaN(amt) || amt < 0) {
      return res.status(400).json({ success: false, message: 'amountPaid must be ≥ 0.' });
    }
    ticket.amountPaid = amt;
  }
  if (originalPrice !== undefined) {
    const op = Number(originalPrice);
    if (Number.isNaN(op) || op < 0) {
      return res.status(400).json({ success: false, message: 'originalPrice must be ≥ 0.' });
    }
    ticket.originalPrice = op;
  }

  ticket.qrDataUrl = await generateTicketQr(ticket.ticketNumber);
  await ticket.save();
  res.json({ success: true, message: 'Ticket updated.', ticket });
});

/**
 * GET /api/admin/data — collection counts + sample rows (in-app DB browser)
 */
const browseData = asyncHandler(async (req, res) => {
  const [users, ticketTypes, tickets, orders, payments, discounts] = await Promise.all([
    User.find().select('-passwordHash').sort({ createdAt: -1 }).limit(50).lean(),
    TicketType.find().sort({ price: 1 }).lean(),
    Ticket.find().sort({ createdAt: -1 }).limit(50).select('-qrDataUrl').lean(),
    Order.find().sort({ createdAt: -1 }).limit(50).lean(),
    Payment.find().sort({ createdAt: -1 }).limit(50).lean(),
    Discount.find().sort({ startDate: 1 }).lean(),
  ]);

  const counts = {
    users: await User.countDocuments(),
    tickettypes: await TicketType.countDocuments(),
    tickets: await Ticket.countDocuments(),
    orders: await Order.countDocuments(),
    payments: await Payment.countDocuments(),
    discounts: await Discount.countDocuments(),
  };

  res.json({
    success: true,
    database: 'o2-ticket-booking',
    counts,
    collections: { users, ticketTypes, tickets, orders, payments, discounts },
  });
});

module.exports = {
  lookupTicket,
  stats,
  listUsers,
  updateUser,
  deleteUser,
  listTickets,
  listOrders,
  listAdminTicketTypes,
  updateTicketType,
  listDiscounts,
  createDiscount,
  updateDiscount,
  deleteDiscount,
  updateTicket,
  browseData,
};
