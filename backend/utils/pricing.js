/**
 * Pure business-logic helpers (unit-tested with Jest).
 * No DB access — easy to test in isolation.
 */
const {
  EVENT_DATE,
  CANCEL_WINDOW_HOURS,
  REFUND_FEE_PERCENT,
  CHILD_AGE_THRESHOLD,
  UPGRADE_RANK,
  TICKET_SALES_START,
} = require('../config/constants');

/**
 * Age in full years on a reference date.
 */
function calculateAge(dateOfBirth, onDate = new Date()) {
  const dob = new Date(dateOfBirth);
  let age = onDate.getFullYear() - dob.getFullYear();
  const m = onDate.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && onDate.getDate() < dob.getDate())) age -= 1;
  return age;
}

function isChild(dateOfBirth, onDate = new Date()) {
  return calculateAge(dateOfBirth, onDate) < CHILD_AGE_THRESHOLD;
}

/**
 * Registered-user early-bird discount by calendar month of purchase (UTC).
 * July 10%, August 5%, September 10%, after September 0%.
 */
function getDiscountPercentForDate(purchaseDate = new Date(), isRegistered = true) {
  if (!isRegistered) return 0;
  const d = new Date(purchaseDate);
  if (d < TICKET_SALES_START) return 0;

  const year = d.getUTCFullYear();
  const month = d.getUTCMonth(); // 0-indexed

  // Only apply 2026 early-bird windows from the brief
  if (year !== 2026) {
    // After 2026 season windows → 0%
    if (year > 2026) return 0;
    return 0;
  }

  if (month === 6) return 10; // July
  if (month === 7) return 5; // August
  if (month === 8) return 10; // September
  return 0; // October onwards
}

function applyDiscount(subtotal, percentOff) {
  const pct = Math.max(0, Math.min(100, Number(percentOff) || 0));
  const discountAmount = Math.round(subtotal * (pct / 100) * 100) / 100;
  const total = Math.round((subtotal - discountAmount) * 100) / 100;
  return { discountPercent: pct, discountAmount, total };
}

/**
 * Refund amount after 20% fee. Returns 0 if not eligible.
 */
function calculateRefundAmount(amountPaid, options = {}) {
  const {
    isRefundable = false,
    isGuestPurchase = false,
    eventDate = EVENT_DATE,
    now = new Date(),
    cancelWindowHours = CANCEL_WINDOW_HOURS,
    feePercent = REFUND_FEE_PERCENT,
  } = options;

  if (!isRefundable) {
    return { allowed: false, refundAmount: 0, reason: 'This ticket type is non-refundable.' };
  }
  if (isGuestPurchase) {
    return { allowed: false, refundAmount: 0, reason: 'Guest-purchased tickets are not eligible for refund.' };
  }

  const msLeft = new Date(eventDate).getTime() - new Date(now).getTime();
  const hoursLeft = msLeft / (1000 * 60 * 60);
  if (hoursLeft < cancelWindowHours) {
    return {
      allowed: false,
      refundAmount: 0,
      reason: `Cancellation only allowed up to ${cancelWindowHours} hours before the event.`,
    };
  }

  const refundAmount = Math.round(amountPaid * (1 - feePercent / 100) * 100) / 100;
  return { allowed: true, refundAmount, reason: null };
}

/**
 * Upgrade-only check + amendment fee (= price difference, capped at new ticket price).
 */
function calculateAmendment(currentCode, newCode, currentPrice, newPrice) {
  const fromRank = UPGRADE_RANK[currentCode];
  const toRank = UPGRADE_RANK[newCode];

  if (fromRank == null || toRank == null) {
    return { allowed: false, fee: 0, reason: 'Unknown ticket type.' };
  }
  if (currentCode === newCode) {
    return { allowed: false, fee: 0, reason: 'Ticket is already this type.' };
  }
  if (toRank < fromRank) {
    return { allowed: false, fee: 0, reason: 'Downgrades are not allowed. Only upgrades are permitted.' };
  }
  if (toRank === fromRank && currentCode !== newCode) {
    // Same rank lateral move (e.g. STANDARD ↔ GROUP) treated as not an upgrade
    return { allowed: false, fee: 0, reason: 'Only upgrades to a higher tier are permitted.' };
  }

  let fee = Math.max(0, Number(newPrice) - Number(currentPrice));
  // Brief: amendment cost cannot exceed the price of the new ticket
  if (fee > Number(newPrice)) fee = Number(newPrice);
  fee = Math.round(fee * 100) / 100;

  return { allowed: true, fee, reason: null };
}

/**
 * Children cannot buy alone — at least one non-child adult must be on the same order.
 */
function validateAccompaniedChildren(allAttendees) {
  if (!Array.isArray(allAttendees) || allAttendees.length === 0) {
    return { ok: false, message: 'At least one attendee is required.' };
  }
  const hasChild = allAttendees.some((a) => a.isChild);
  const hasAdult = allAttendees.some((a) => !a.isChild);
  if (hasChild && !hasAdult) {
    return {
      ok: false,
      message: 'Children cannot buy tickets alone. A parent/adult must be on the same order.',
    };
  }
  return { ok: true, message: null };
}

function salesHaveStarted(now = new Date()) {
  return new Date(now) >= TICKET_SALES_START;
}

function ageGroupLabel(dateOfBirth, onDate = new Date()) {
  const age = calculateAge(dateOfBirth, onDate);
  if (age < 16) return 'under_16';
  if (age < 25) return '16_24';
  if (age < 40) return '25_39';
  if (age < 60) return '40_59';
  return '60_plus';
}

module.exports = {
  calculateAge,
  isChild,
  getDiscountPercentForDate,
  applyDiscount,
  calculateRefundAmount,
  calculateAmendment,
  validateAccompaniedChildren,
  salesHaveStarted,
  ageGroupLabel,
  CHILD_AGE_THRESHOLD,
  EVENT_DATE,
  CANCEL_WINDOW_HOURS,
  REFUND_FEE_PERCENT,
};
