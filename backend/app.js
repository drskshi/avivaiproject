/**
 * Express application (exported for tests + server).
 */
const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const ticketTypeRoutes = require('./routes/ticketTypeRoutes');
const orderRoutes = require('./routes/orderRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const adminRoutes = require('./routes/adminRoutes');
const contentRoutes = require('./routes/contentRoutes');

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan(process.env.NODE_ENV === 'test' ? 'tiny' : 'dev'));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/ticket-types', ticketTypeRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'O2 Ticket Booking API is running',
    event: process.env.EVENT_NAME || 'Dua Lipa Live at The O2',
    date: process.env.EVENT_DATE || '2026-11-30',
  });
});

// Static frontend (mobile-first HTML/CSS/JS)
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

app.use(errorHandler);

module.exports = app;
