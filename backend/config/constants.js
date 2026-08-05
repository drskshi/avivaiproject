/**
 * Shared business constants for the O2 ticket booking app.
 * Defaults match the assignment brief; override dates via .env where noted.
 */

const EVENT_DATE = new Date(process.env.EVENT_DATE || '2026-11-30T19:00:00.000Z');
const TICKET_SALES_START = new Date(process.env.TICKET_SALES_START || '2026-07-01T00:00:00.000Z');
const CANCEL_WINDOW_HOURS = 72;
const REFUND_FEE_PERCENT = 20;
const CHILD_AGE_THRESHOLD = 16; // under 16 = child

/** Ticket type catalogue used by seed + validation */
const TICKET_TYPE_DEFS = [
  {
    code: 'RESTRICTED',
    name: 'Single Adult Restricted',
    price: 30,
    maxAttendees: 1,
    isRefundable: false,
    isAmendable: false,
    totalStock: 700,
    description: 'Restricted view. Non-refundable and non-amendable.',
  },
  {
    code: 'STANDARD',
    name: 'Single Adult Standard',
    price: 40,
    maxAttendees: 1,
    isRefundable: true,
    isAmendable: true,
    totalStock: 800,
    description: 'Standard seating. Refundable and amendable (fees apply).',
  },
  {
    code: 'VIP',
    name: 'Single Adult VIP',
    price: 250,
    maxAttendees: 1,
    isRefundable: false,
    isAmendable: true,
    totalStock: 100,
    description: 'VIP experience. Non-refundable; upgrades/amendments allowed (fees apply).',
  },
  {
    code: 'GROUP_STANDARD',
    name: 'Group Standard',
    price: 120,
    maxAttendees: 5,
    isRefundable: true,
    isAmendable: true,
    totalStock: 400,
    description: 'Flat £120 for up to 5 people (adults/children). Family ticket included.',
  },
];

/** Upgrade ranking — higher rank = better tier (downgrades blocked) */
const UPGRADE_RANK = {
  RESTRICTED: 1,
  STANDARD: 2,
  GROUP_STANDARD: 2,
  VIP: 3,
};

module.exports = {
  EVENT_DATE,
  TICKET_SALES_START,
  CANCEL_WINDOW_HOURS,
  REFUND_FEE_PERCENT,
  CHILD_AGE_THRESHOLD,
  TICKET_TYPE_DEFS,
  UPGRADE_RANK,
};
