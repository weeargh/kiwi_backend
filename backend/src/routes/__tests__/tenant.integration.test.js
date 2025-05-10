/**
 * Integration test for the Tenant API endpoints
 * Tests the /api/tenant endpoints with a live database connection to kiwi3_test
 */
const request = require('supertest');
const app = require('../../index');
const { pool } = require('../../config/db');
const { validateTenantStructure, MOCK_TENANT_ID } = require('../../__tests__/test-utils');

// Mock the auth middleware
jest.mock('../../middleware/auth');
const { checkJwt, syncUser, authorizeRole } = require('../../middleware/auth');

describe('Tenant API - Integration Tests', () => {
  // Before each test, reset the checkJwt mock to the successful state
  beforeEach(() => {
    checkJwt.resetToSuccess();
  });

  // Test database connectivity first - if this fails, other tests will likely fail too
  it('should connect to the test database', async () => {
    // Verify we're in test mode
    expect(process.env.NODE_ENV).toBe('test');
    
    // Connect to the test database and verify its name
    const client = await pool.connect();
    const testDbName = process.env.DB_NAME_TEST || 'kiwi3_test';
    
    expect(client.database).toBe(testDbName);
    client.release();
  });

  describe('GET /api/tenant', () => {
    it('should fetch tenant details when authenticated with valid tenant ID', async () => {
      // Execute the request with a mock Authorization header
      // Our auth middleware is already mocked to simulate successful authentication
      const response = await request(app)
        .get('/api/tenant')
        .set('Authorization', 'Bearer mock-token')
        .expect(200);

      // Verify response structure and content
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      
      // Use the helper to validate tenant structure
      validateTenantStructure(response.body.data);
      
      // Verify specific values for the test tenant
      const tenant = response.body.data;
      expect(tenant.tenant_id).toBe(MOCK_TENANT_ID);
      expect(tenant.name).toBe('Testt Co');
      expect(tenant.currency).toBe('USD');
      expect(tenant.timezone).toBe('Asia/Bangkok');
    });

    it('should return 401 unauthorized when authentication fails', async () => {
      // Configure the checkJwt mock to simulate authentication failure
      checkJwt.simulateAuthFailure();
      
      // Execute the request with a mock Authorization header that should "fail" auth
      const response = await request(app)
        .get('/api/tenant')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
      
      // Verify error response
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    // Future test ideas:
    // - Test with a tenant ID that doesn't exist in the database
    // - Test with a non-admin role
  });

  describe('PATCH /api/tenant', () => {
    // Placeholder for PATCH endpoint tests
    // To be implemented when testing update functionality
    
    // it('should update tenant details when authenticated as admin', async () => {
    //   // Test implementation
    // });
    
    // it('should prevent updates when authenticated as non-admin', async () => {
    //   // Test implementation
    // });
  });

  // Close the database pool after all tests to prevent Jest from hanging
  afterAll(async () => {
    await pool.end();
  });
}); 