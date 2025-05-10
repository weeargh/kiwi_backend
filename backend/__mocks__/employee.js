// Mock implementation of the employee routes
const express = require('express');
const router = express.Router();

// Mock the router methods to return empty functions
router.post = jest.fn(() => router);
router.get = jest.fn(() => router);
router.patch = jest.fn(() => router);
router.delete = jest.fn(() => router);

module.exports = router; 