// Explicitly mocking the problematic modules
jest.mock('./src/routes/employee.js', () => {
  const express = require('express');
  const router = express.Router();
  
  // Mock the router methods to return empty functions
  router.post = jest.fn(() => router);
  router.get = jest.fn(() => router);
  router.patch = jest.fn(() => router);
  router.delete = jest.fn(() => router);
  
  return router;
}, { virtual: true });

jest.mock('./src/routes/grant.js', () => {
  const express = require('express');
  const router = express.Router();
  
  // Mock the router methods to return empty functions
  router.post = jest.fn(() => router);
  router.get = jest.fn(() => router);
  router.patch = jest.fn(() => router);
  router.delete = jest.fn(() => router);
  
  return router;
}, { virtual: true });

console.log('Mocks have been configured'); 