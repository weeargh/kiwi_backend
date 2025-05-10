const path = require('path');

// Set NODE_ENV to 'test' BEFORE loading any other modules or .env files
process.env.NODE_ENV = 'test';

// Load test environment variables from .env.test file
const testEnvPath = path.join(__dirname, '.env.test');

console.log('[jest.global-setup.js] NODE_ENV set to:', process.env.NODE_ENV);
console.log('[jest.global-setup.js] Loading test env from:', testEnvPath);

// Ensure dotenv is installed in your backend project
const dotenvResult = require('dotenv').config({ path: testEnvPath, debug: true });

if (dotenvResult.error) {
  console.error('[jest.global-setup.js] dotenv.config() error:', dotenvResult.error.message);
} else {
  console.log('[jest.global-setup.js] dotenv.config() loaded variables:', dotenvResult.parsed);
}

console.log('[jest.global-setup.js] process.env.DB_USER after dotenv config:', process.env.DB_USER);
console.log('[jest.global-setup.js] process.env.DB_HOST after dotenv config:', process.env.DB_HOST);
console.log('[jest.global-setup.js] process.env.DB_NAME_TEST for test DB pool:', process.env.DB_NAME_TEST || 'kiwi3_test');

// Import pg Pool
const { Pool } = require('pg');

// Define these constants here or import them if they are centralized
const MOCK_TENANT_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const mockAdminUserId = '11111111-1111-1111-1111-111111111111';

module.exports = async () => {
  console.log('[jest.global-setup.js] Global setup: Seeding test database with mock tenant and admin user...');

  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME_TEST || 'kiwi3_test', // Ensure this matches your test DB name
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432', 10),
  });

  const client = await pool.connect();

  try {
    // Seed Tenant (Upsert)
    await client.query(
      "INSERT INTO tenants (tenant_id, name, currency, timezone) VALUES ($1, 'Mock Global Tenant', 'USD', 'UTC') ON CONFLICT (tenant_id) DO NOTHING",
      [MOCK_TENANT_ID]
    );
    console.log(`[jest.global-setup.js] Ensured mock tenant exists: ${MOCK_TENANT_ID}`);

    // Seed Admin User (Upsert - ensuring it's active and linked to tenant)
    await client.query(
      "INSERT INTO user_accounts (user_id, tenant_id, email, name, role, status, auth0_user_id) VALUES ($1, $2, 'global.admin@test.com', 'Global Mock Admin', 'admin', 'active', $3) ON CONFLICT (user_id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, email = EXCLUDED.email, name = EXCLUDED.name, role = EXCLUDED.role, status = EXCLUDED.status, auth0_user_id = EXCLUDED.auth0_user_id, deleted_at = NULL", // Ensure deleted_at is NULL
      [mockAdminUserId, MOCK_TENANT_ID, 'auth0|globaladmin']
    );
    console.log(`[jest.global-setup.js] Ensured mock admin user exists and is active: ${mockAdminUserId}`);

  } catch (error) {
    console.error('[jest.global-setup.js] Error during database seeding:', error);
    // Re-throw or handle error as appropriate for your setup to potentially stop tests
    throw error; 
  } finally {
    client.release();
    await pool.end(); // Close the pool after setup
    console.log('[jest.global-setup.js] Global setup database seeding complete.');
  }

  console.log('[jest.global-setup.js] Global setup asynchronous function has been executed.');
  // You can perform other global async setup tasks here if needed
  // For example, starting a mock server or seeding a database (though usually done elsewhere)
  // IMPORTANT: Ensure this function completes for Jest to proceed.
}; 