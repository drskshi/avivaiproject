/**
 * Unique human-readable ticket numbers for QR encoding.
 */
const { randomUUID } = require('crypto');

function generateTicketNumber() {
  const short = randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
  return `O2-${short}`;
}

module.exports = { generateTicketNumber };
