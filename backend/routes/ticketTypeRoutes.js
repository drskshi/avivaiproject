const express = require('express');
const { listTicketTypes } = require('../controllers/ticketTypeController');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', optionalAuth, listTicketTypes);

module.exports = router;
