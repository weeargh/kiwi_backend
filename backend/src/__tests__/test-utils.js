/**
 * Test utilities and helpers for backend tests
 */

// Define a constant tenant ID that matches the one seeded in the test database
const MOCK_TENANT_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
// Define a constant pool ID for consistent test data
const MOCK_POOL_ID = '11111111-2222-3333-4444-555555555555';

/**
 * Creates a mock user with the given role for testing authorization
 * @param {string} role - The role to assign to the user (e.g., 'admin', 'user')
 * @param {object} overrides - Additional properties to override on the user object
 * @returns {object} - A mock user object
 */
function createMockUser(role = 'admin', overrides = {}) {
  return {
    id: 'test-user-id-123',
    tenantId: MOCK_TENANT_ID,
    auth0Id: 'auth0|testuser123',
    role: role,
    email: 'testuser@example.com',
    name: 'Test User',
    ...overrides
  };
}

/**
 * Creates test tenant data that matches the expected structure from the database
 * @param {object} overrides - Properties to override on the tenant object
 * @returns {object} - A mock tenant object matching database schema
 */
function createMockTenant(overrides = {}) {
  return {
    tenant_id: MOCK_TENANT_ID,
    name: 'Testt Co',
    currency: 'USD',
    timezone: 'Asia/Bangkok',
    created_at: new Date().toISOString(),
    ...overrides
  };
}

/**
 * Helper to validate tenant object structure in responses
 * @param {object} tenant - The tenant object to validate
 */
function validateTenantStructure(tenant) {
  expect(tenant).toBeDefined();
  expect(tenant.tenant_id).toBeDefined();
  expect(tenant.name).toBeDefined();
  expect(tenant.currency).toBeDefined();
  expect(tenant.timezone).toBeDefined();
}

/**
 * Helper to validate user object structure in responses
 * @param {object} user - The user object to validate
 */
function validateUserStructure(user) {
  expect(user).toBeDefined();
  expect(user.user_id).toBeDefined();
  expect(user.tenant_id).toBeDefined();
  expect(user.email).toBeDefined();
  expect(user.name).toBeDefined();
  expect(user.role).toBeDefined();
  expect(user.status).toBeDefined();
  // auth0_user_id might be null for newly created users
}

/**
 * Helper to validate equity pool object structure in responses
 * @param {object} equityPool - The equity pool object to validate
 */
function validateEquityPoolStructure(equityPool) {
  expect(equityPool).toBeDefined();
  expect(equityPool.pool_id).toBeDefined();
  expect(equityPool.tenant_id).toBeDefined();
  expect(equityPool.initial_amount).toBeDefined();
  expect(equityPool.total_pool).toBeDefined();
  expect(equityPool.granted_shares).toBeDefined();
  expect(equityPool.returned_shares).toBeDefined();
  expect(equityPool.available_shares).toBeDefined();
  expect(equityPool.created_by).toBeDefined();
  expect(equityPool.created_at).toBeDefined();
  
  // Ensure decimal fields are formatted correctly
  expect(typeof equityPool.initial_amount).toBe('string');
  expect(typeof equityPool.total_pool).toBe('string');
  expect(typeof equityPool.granted_shares).toBe('string');
  expect(typeof equityPool.returned_shares).toBe('string');
  expect(typeof equityPool.available_shares).toBe('string');
}

/**
 * Helper to validate pool event object structure in responses
 * @param {object} poolEvent - The pool event object to validate
 */
function validatePoolEventStructure(poolEvent) {
  expect(poolEvent).toBeDefined();
  expect(poolEvent.event_id).toBeDefined();
  expect(poolEvent.pool_id).toBeDefined();
  expect(poolEvent.tenant_id).toBeDefined();
  expect(poolEvent.amount).toBeDefined();
  expect(poolEvent.event_type).toBeDefined();
  expect(poolEvent.effective_date).toBeDefined();
  expect(poolEvent.created_by).toBeDefined();
  expect(poolEvent.created_at).toBeDefined();
  
  // Ensure decimal fields are formatted correctly
  expect(typeof poolEvent.amount).toBe('string');
  
  // Validate event type
  expect(['initial', 'top_up', 'reduction']).toContain(poolEvent.event_type);
}

/**
 * Helper to validate price per share (PPS) object structure in responses
 * @param {object} pps - The PPS object to validate
 */
function validatePPSStructure(pps) {
  expect(pps).toBeDefined();
  expect(pps.pps_id).toBeDefined();
  expect(pps.tenant_id).toBeDefined();
  expect(pps.effective_date).toBeDefined();
  expect(pps.price_per_share).toBeDefined();
  expect(pps.created_by).toBeDefined();
  expect(pps.created_at).toBeDefined();
  
  // Ensure decimal field is formatted correctly
  expect(typeof pps.price_per_share).toBe('string');
}

// Add a dummy test to satisfy Jest's requirement for files in __tests__ directories
describe('Test Utilities', () => {
  it('should export the expected utility functions', () => {
    expect(MOCK_TENANT_ID).toBeDefined();
    expect(createMockUser).toBeDefined();
    expect(createMockTenant).toBeDefined();
    expect(validateTenantStructure).toBeDefined();
    expect(validateUserStructure).toBeDefined();
    expect(validateEquityPoolStructure).toBeDefined();
    expect(validatePoolEventStructure).toBeDefined();
    expect(validatePPSStructure).toBeDefined();
  });
});

module.exports = {
  MOCK_TENANT_ID,
  MOCK_POOL_ID,
  createMockUser,
  createMockTenant,
  validateTenantStructure,
  validateUserStructure,
  validateEquityPoolStructure,
  validatePoolEventStructure,
  validatePPSStructure
}; 