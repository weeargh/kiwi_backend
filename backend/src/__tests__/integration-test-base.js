/**
 * Integration test base helper
 * Provides transaction isolation and consistent test data for integration tests
 */
const request = require('supertest');
const app = require('../index');
const DbTestHelper = require('./db-test-helper');
const { MOCK_TENANT_ID } = require('./test-utils');

// Mock auth middleware for all integration tests
jest.mock('../middleware/auth');
const { checkJwt, syncUser, authorizeRole } = require('../middleware/auth');

/**
 * Base class for integration tests with transaction support
 * Provides common test setup and teardown functionality
 */
class IntegrationTestBase {
  constructor() {
    this.app = app;
    this.request = request;
    this.dbHelper = new DbTestHelper();
    this.defaultAdminId = '11111111-1111-1111-1111-111111111111';
    this.defaultEmployeeId = '22222222-2222-2222-2222-222222222222';
    this.MOCK_TENANT_ID = MOCK_TENANT_ID;
  }
  
  /**
   * Set up the test environment with a transaction
   * Call this in beforeEach() to isolate each test
   */
  async setup() {
    await this.dbHelper.startTransaction();
  }
  
  /**
   * Clean up the test environment by rolling back the transaction
   * Call this in afterEach() to clean up after each test
   */
  async cleanup() {
    await this.dbHelper.rollbackTransaction();
  }
  
  /**
   * Helper method to get authenticated supertest instance
   * @param {string} userId - The user ID for authentication
   * @param {string} role - The user role (admin, employee)
   * @param {string} [tenantId=MOCK_TENANT_ID] - The tenant ID
   * @returns {Object} Configured supertest instance
   */
  getAuthenticatedRequest(userId, role, tenantId = MOCK_TENANT_ID) {
    this.mockAuthMiddleware(userId, role, tenantId);
    return request(app);
  }
  
  /**
   * Mock the authentication middleware
   * @param {string} userId - The user ID for authentication
   * @param {string} role - The user role (admin, employee)
   * @param {string} [tenantId=MOCK_TENANT_ID] - The tenant ID
   */
  mockAuthMiddleware(userId, role, tenantId = MOCK_TENANT_ID) {
    checkJwt.mockImplementation((req, res, next) => {
      req.auth = { 
        payload: { 
          sub: `auth0|${userId}`,
          'https://api.domain.com/tenant_id': tenantId,
          'https://api.domain.com/roles': role,
          'https://api.domain.com/email': `${role}@test.com`,
          'https://api.domain.com/name': `Test ${role.charAt(0).toUpperCase() + role.slice(1)}`
        } 
      };
      next();
    });
    
    syncUser.mockImplementation((req, res, next) => {
      req.user = { 
        id: userId, 
        tenantId: tenantId, 
        role: role,
        auth0Id: `auth0|${userId}`
      };
      next();
    });
    
    // Handle both string and array roles
    authorizeRole.mockImplementation((requiredRoles) => (req, res, next) => {
      const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
      if (roles.includes(req.user.role)) {
        next();
      } else {
        res.status(403).json({ 
          success: false, 
          error: { 
            code: 'FORBIDDEN', 
            message: 'User does not have the required role' 
          } 
        });
      }
    });
  }
  
  /**
   * Create test equity pool in the database
   * @param {Object} overrides - Properties to override
   * @returns {Promise<Object>} Created pool
   */
  async createTestPool(overrides = {}) {
    return this.dbHelper.createTestEquityPool(overrides);
  }
  
  /**
   * Create test employee in the database
   * @param {Object} overrides - Properties to override
   * @returns {Promise<Object>} Created employee
   */
  async createTestEmployee(overrides = {}) {
    return this.dbHelper.createTestEmployee(overrides);
  }
  
  /**
   * Create test user in the database
   * @param {string} role - User role
   * @param {Object} overrides - Properties to override
   * @returns {Promise<Object>} Created user
   */
  async createTestUser(role = 'admin', overrides = {}) {
    return this.dbHelper.createTestUser(role, overrides);
  }
  
  /**
   * Helper to execute direct database query in the transaction
   * @param {string} text - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} Query result
   */
  async query(text, params = []) {
    return this.dbHelper.query(text, params);
  }
}

module.exports = IntegrationTestBase;
