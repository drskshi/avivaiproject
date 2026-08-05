/**
 * Jest unit tests for core business logic (no DB required).
 */
const {
  getDiscountPercentForDate,
  applyDiscount,
  calculateRefundAmount,
  calculateAmendment,
  validateAccompaniedChildren,
  salesHaveStarted,
} = require('../backend/utils/pricing');

describe('Discount calculation', () => {
  test('July 2026 registered → 10%', () => {
    expect(getDiscountPercentForDate(new Date('2026-07-15T12:00:00Z'), true)).toBe(10);
  });

  test('August 2026 registered → 5%', () => {
    expect(getDiscountPercentForDate(new Date('2026-08-10T12:00:00Z'), true)).toBe(5);
  });

  test('September 2026 registered → 10%', () => {
    expect(getDiscountPercentForDate(new Date('2026-09-01T00:00:00Z'), true)).toBe(10);
  });

  test('October onwards → 0%', () => {
    expect(getDiscountPercentForDate(new Date('2026-10-01T00:00:00Z'), true)).toBe(0);
  });

  test('Guests never get discount', () => {
    expect(getDiscountPercentForDate(new Date('2026-07-15T12:00:00Z'), false)).toBe(0);
  });

  test('applyDiscount rounds correctly', () => {
    const r = applyDiscount(40, 10);
    expect(r.discountAmount).toBe(4);
    expect(r.total).toBe(36);
  });
});

describe('Refund calculation & 72-hour window', () => {
  const eventDate = new Date('2026-11-30T19:00:00Z');

  test('eligible refund returns 80% (20% fee)', () => {
    const r = calculateRefundAmount(100, {
      isRefundable: true,
      isGuestPurchase: false,
      eventDate,
      now: new Date('2026-11-20T19:00:00Z'),
    });
    expect(r.allowed).toBe(true);
    expect(r.refundAmount).toBe(80);
  });

  test('blocked inside 72-hour window', () => {
    const r = calculateRefundAmount(100, {
      isRefundable: true,
      isGuestPurchase: false,
      eventDate,
      now: new Date('2026-11-29T00:00:00Z'),
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/72 hours/i);
  });

  test('guest purchases not refundable', () => {
    const r = calculateRefundAmount(100, {
      isRefundable: true,
      isGuestPurchase: true,
      eventDate,
      now: new Date('2026-11-01T00:00:00Z'),
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/Guest/i);
  });

  test('non-refundable ticket type blocked', () => {
    const r = calculateRefundAmount(250, {
      isRefundable: false,
      isGuestPurchase: false,
      eventDate,
      now: new Date('2026-11-01T00:00:00Z'),
    });
    expect(r.allowed).toBe(false);
  });
});

describe('Upgrade-only amendment enforcement', () => {
  test('STANDARD → VIP allowed with price difference fee', () => {
    const r = calculateAmendment('STANDARD', 'VIP', 40, 250);
    expect(r.allowed).toBe(true);
    expect(r.fee).toBe(210);
  });

  test('VIP → STANDARD downgrade blocked', () => {
    const r = calculateAmendment('VIP', 'STANDARD', 250, 40);
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/Downgrade/i);
  });

  test('amendment fee cannot exceed new ticket price', () => {
    const r = calculateAmendment('RESTRICTED', 'VIP', 30, 250);
    expect(r.allowed).toBe(true);
    expect(r.fee).toBeLessThanOrEqual(250);
  });

  test('same type blocked', () => {
    const r = calculateAmendment('VIP', 'VIP', 250, 250);
    expect(r.allowed).toBe(false);
  });
});

describe('Children accompaniment', () => {
  test('child alone rejected', () => {
    const r = validateAccompaniedChildren([{ isChild: true }]);
    expect(r.ok).toBe(false);
  });

  test('child with adult accepted', () => {
    const r = validateAccompaniedChildren([{ isChild: true }, { isChild: false }]);
    expect(r.ok).toBe(true);
  });
});

describe('Sales start gate', () => {
  test('sales started by July 2026', () => {
    expect(salesHaveStarted(new Date('2026-07-01T00:00:00Z'))).toBe(true);
  });

  test('sales blocked before July 2026', () => {
    expect(salesHaveStarted(new Date('2026-06-30T23:59:59Z'))).toBe(false);
  });
});

describe('Overbooking prevention helper contract', () => {
  /**
   * Atomic reserve is implemented on TicketType.reserveStock via
   * findOneAndUpdate({ remainingStock: { $gte: qty } }, { $inc: -qty }).
   * Here we unit-test the guard condition logic mirrored in JS.
   */
  function canReserve(remaining, qty) {
    return remaining >= qty;
  }

  test('cannot reserve more than remaining stock', () => {
    expect(canReserve(0, 1)).toBe(false);
    expect(canReserve(5, 6)).toBe(false);
    expect(canReserve(5, 5)).toBe(true);
  });
});
