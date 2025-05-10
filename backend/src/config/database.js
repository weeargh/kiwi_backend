/**
 * Database configuration for all environments
 * Supports development, test, and e2e environments
 */
const { Pool } = require('pg');
require('dotenv').config({
  path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env'
});

// Common options used across all database connections
const commonOptions = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'uniqueuser123',
  password: process.env.DB_PASSWORD || 'password',
};

// Main database pool for regular application use
const mainPool = new Pool({
  ...commonOptions,
  database: process.env.DB_NAME || 'uniquedb456',
  max: 20, // Maximum number of clients
  idleTimeoutMillis: 30000 // Close idle clients after 30 seconds
});

// Test database pool for integration tests
const testPool = new Pool({
  ...commonOptions,
  database: process.env.DB_NAME_TEST || 'uniquedb456_test',
  max: 5, // Fewer connections needed for tests
  idleTimeoutMillis: 10000 // Shorter timeout for tests
});

// E2E test database pool
const e2ePool = new Pool({
  ...commonOptions,
  database: process.env.DB_NAME_E2E || 'uniquedb456_e2e',
  max: 3, // Minimal connections for E2E tests
  idleTimeoutMillis: 10000
});

// Get the appropriate pool based on the current environment
const getPool = () => {
  switch (process.env.NODE_ENV) {
    case 'test':
      return testPool;
    case 'e2e':
      return e2ePool;
    default:
      return mainPool;
  }
};

// Export both the resolved pool and the individual pools for specific use cases
module.exports = {
  pool: getPool(),
  mainPool,
  testPool,
  e2ePool
};
