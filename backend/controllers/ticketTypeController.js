const TicketType = require('../models/TicketType');
const { asyncHandler } = require('../middleware/errorHandler');
const { getDiscountPercentForDate } = require('../utils/pricing');

/**
 * GET /api/ticket-types — public catalogue with live stock
 */
const listTicketTypes = asyncHandler(async (req, res) => {
  const types = await TicketType.find().sort({ price: 1 }).lean();
  const isRegistered = !!(req.user && !req.user.isGuest && req.user.emailVerified);
  const discountPercent = getDiscountPercentForDate(new Date(), isRegistered);

  res.json({
    success: true,
    discountPercent,
    isRegistered,
    ticketTypes: types.map((t) => ({
      ...t,
      discountedPrice:
        discountPercent > 0
          ? Math.round(t.price * (1 - discountPercent / 100) * 100) / 100
          : t.price,
    })),
  });
});

module.exports = { listTicketTypes };
