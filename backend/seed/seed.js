/**
 * Seed ticket types, discount windows, and an admin user.
 * Usage: npm run seed
 */
require('dotenv').config();
const connectDB = require('../config/db');
const User = require('../models/User');
const TicketType = require('../models/TicketType');
const Discount = require('../models/Discount');
const { TICKET_TYPE_DEFS } = require('../config/constants');

async function seed() {
  await connectDB();

  console.log('Seeding ticket types...');
  for (const def of TICKET_TYPE_DEFS) {
    await TicketType.findOneAndUpdate(
      { code: def.code },
      {
        ...def,
        remainingStock: def.totalStock,
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    console.log(`  ✓ ${def.code} — stock ${def.totalStock}`);
  }

  console.log('Seeding discount windows (2026)...');
  const discounts = [
    {
      name: 'July Early Bird',
      percentOff: 10,
      startDate: new Date('2026-07-01T00:00:00.000Z'),
      endDate: new Date('2026-07-31T23:59:59.999Z'),
      registeredOnly: true,
      isActive: true,
    },
    {
      name: 'August Discount',
      percentOff: 5,
      startDate: new Date('2026-08-01T00:00:00.000Z'),
      endDate: new Date('2026-08-31T23:59:59.999Z'),
      registeredOnly: true,
      isActive: true,
    },
    {
      name: 'September Discount',
      percentOff: 10,
      startDate: new Date('2026-09-01T00:00:00.000Z'),
      endDate: new Date('2026-09-30T23:59:59.999Z'),
      registeredOnly: true,
      isActive: true,
    },
  ];

  await Discount.deleteMany({});
  await Discount.insertMany(discounts);
  console.log(`  ✓ ${discounts.length} discount rules`);

  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@o2tickets.local').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
  let admin = await User.findOne({ email: adminEmail });
  const passwordHash = await User.hashPassword(adminPassword);

  if (!admin) {
    admin = await User.create({
      email: adminEmail,
      passwordHash,
      firstName: process.env.ADMIN_FIRST_NAME || 'System',
      lastName: process.env.ADMIN_LAST_NAME || 'Admin',
      dateOfBirth: new Date('1990-01-01'),
      role: 'admin',
      isGuest: false,
      emailVerified: true, // pre-verified admin for testing
    });
    console.log(`  ✓ Created pre-verified admin ${adminEmail}`);
  } else {
    admin.passwordHash = passwordHash;
    admin.role = 'admin';
    admin.isGuest = false;
    admin.emailVerified = true;
    await admin.save();
    console.log(`  ✓ Updated pre-verified admin ${adminEmail}`);
  }

  console.log('\nSeed complete.');
  console.log(`Admin login: ${adminEmail} / ${adminPassword}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
