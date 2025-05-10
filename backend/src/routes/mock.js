const express = require('express');
const router = express.Router();
// Minimal mock router for test imports
router.get('/', (req, res) => res.json({ success: true, message: 'Mock route' }));
module.exports = router;
