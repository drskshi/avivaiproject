const express = require('express');
const {
  myTickets,
  getTicket,
  cancelTicket,
  amendTicket,
} = require('../controllers/ticketController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.get('/mine', myTickets);
router.get('/:id', getTicket);
router.post('/:id/cancel', cancelTicket);
router.post('/:id/amend', amendTicket);

module.exports = router;
