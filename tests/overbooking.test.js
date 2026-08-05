/**
 * Integration-style test for atomic stock reservation (requires MongoDB).
 * Skips automatically if MONGODB_URI is missing.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const TicketType = require('../backend/models/TicketType');

const hasUri = !!process.env.MONGODB_URI;

(hasUri ? describe : describe.skip)('Atomic overbooking prevention', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  test('findOneAndUpdate refuses when stock insufficient', async () => {
    const code = 'TEST_OVERBOOK_' + Date.now();
    // Use a temporary VIP-like doc — code enum won't allow arbitrary codes,
    // so we reuse VIP remainingStock snapshot and restore after.
    const vip = await TicketType.findOne({ code: 'VIP' });
    if (!vip) {
      console.warn('VIP type not seeded — run npm run seed first');
      return;
    }

    const original = vip.remainingStock;
    // Force stock to 1
    vip.remainingStock = 1;
    await vip.save();

    const ok = await TicketType.reserveStock('VIP', 1);
    expect(ok).not.toBeNull();
    expect(ok.remainingStock).toBe(0);

    const fail = await TicketType.reserveStock('VIP', 1);
    expect(fail).toBeNull();

    // Restore
    await TicketType.findOneAndUpdate({ code: 'VIP' }, { remainingStock: original });
  });
});
