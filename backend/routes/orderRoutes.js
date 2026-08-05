const express = require('express');
const { createOrder, payOrder, myOrders, getOrder } = require('../controllers/orderController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.post('/', createOrder);
router.get('/mine', myOrders);
router.get('/:id', getOrder);
router.post('/:id/pay', payOrder);

module.exports = router;
