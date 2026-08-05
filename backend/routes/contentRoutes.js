const express = require('express');
const content = require('../config/content');

const router = express.Router();

/** Public editable copy for the frontend */
router.get('/', (req, res) => {
  res.json({ success: true, content });
});

module.exports = router;
