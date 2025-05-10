const express = require('express');
const logger = require('../config/logger');

const router = express.Router();

// Hardcoded list of supported currencies as per api.yml example and general expectation
const supportedCurrencies = [
  { code: 'USD', name: 'United States Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound Sterling', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp' } // As per api.yml example
];

/**
 * GET /api/constants/currencies
 * Retrieves a list of supported currencies.
 * Protected by checkJwt and syncUser middleware applied globally in index.js for /api routes.
 */
router.get('/currencies', (req, res) => {
  logger.info('GET /api/constants/currencies called');
  res.json({
    success: true,
    data: supportedCurrencies
  });
});

module.exports = router; 