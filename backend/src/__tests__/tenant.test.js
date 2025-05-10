jest.mock('../middleware/auth');
const request = require('supertest');
const app = require('../index');
const { createMockTenant, validateTenantStructure } = require('./test-utils');
const { checkJwt } = require('../middleware/auth');

describe('Tenant API', () => {
  // Reset mocks before each test
  beforeEach(() => {
    // Ensure checkJwt is set to successful authentication mode
    checkJwt.resetToSuccess();
  });

  describe('GET /api/tenant', () => {
    it('should return tenant details for an authenticated user', async () => {
      // Since we've mocked the auth middleware to simulate successful auth,
      // and we have a real test database with seeded data, this should now return 200
      const res = await request(app)
        .get('/api/tenant')
        .set('Authorization', 'Bearer mock-token')
        .expect(200);
      
      // Verify response structure
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      
      // Validate tenant data structure
      validateTenantStructure(res.body.data);
    });
    
    it('should return 401 when authentication fails', async () => {
      // Configure auth middleware to simulate authentication failure
      checkJwt.simulateAuthFailure();
      
      const res = await request(app)
        .get('/api/tenant')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
      
      // Verify error response
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('PATCH /api/tenant', () => {
    // These are placeholders for future tests
    
    // it('should update tenant details for an authenticated admin user', async () => {
    //   // Test implementation
    // });
    
    // it('should return 403 if authenticated user is not an admin', async () => {
    //   // Test implementation
    // });
  });
  
  // Close database connections after all tests
  afterAll(async () => {
    // Close database connections if necessary
    if (app.locals.pool) {
      await app.locals.pool.end();
    }
  });
}); 