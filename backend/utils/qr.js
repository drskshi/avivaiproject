/**
 * QR code generation for unique ticket numbers.
 */
const QRCode = require('qrcode');

/**
 * Encode ticketNumber as a PNG data URL (scannable / downloadable).
 */
async function generateTicketQr(ticketNumber) {
  return QRCode.toDataURL(String(ticketNumber), {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 280,
    color: { dark: '#0b1c2c', light: '#ffffff' },
  });
}

module.exports = { generateTicketQr };
