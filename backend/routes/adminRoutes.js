const express = require('express');
const {
  lookupTicket,
  stats,
  listUsers,
  updateUser,
  deleteUser,
  listTickets,
  listOrders,
  listAdminTicketTypes,
  updateTicketType,
  listDiscounts,
  createDiscount,
  updateDiscount,
  deleteDiscount,
  updateTicket,
  browseData,
} = require('../controllers/adminController');
const {
  cancelTicket,
  amendTicket,
} = require('../controllers/ticketController');
const { protect, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(protect, requireAdmin);

router.get('/stats', stats);
router.get('/data', browseData);

router.get('/ticket-types', listAdminTicketTypes);
router.patch('/ticket-types/:id', updateTicketType);

router.get('/discounts', listDiscounts);
router.post('/discounts', createDiscount);
router.patch('/discounts/:id', updateDiscount);
router.delete('/discounts/:id', deleteDiscount);

router.get('/tickets/lookup', lookupTicket);
router.get('/tickets', listTickets);
router.patch('/tickets/:id', updateTicket);
router.post('/tickets/:id/cancel', cancelTicket);
router.post('/tickets/:id/amend', amendTicket);

router.get('/orders', listOrders);
router.get('/users', listUsers);
router.patch('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

module.exports = router;
