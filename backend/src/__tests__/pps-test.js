const request = require('supertest');
const app = require('../test-index');
const { checkJwt } = require('../middleware/auth');

// Tell Jest to use the mock for the auth middleware
jest.mock('../middleware/auth');

describe('PPS API', () => {
  // Reset mocks before each test
  beforeEach(() => {
    // Ensure checkJwt is set to successful authentication mode
    checkJwt.resetToSuccess();
  });

  describe('GET /api/pps', () => {
    it('should return PPS history for an authenticated user', async () => {
      const res = await request(app)
        .get('/api/pps')
        .set('Authorization', 'Bearer mock-token')
        .expect(200);
      
      // Verify response structure
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.items).toBeDefined();
      expect(Array.isArray(res.body.data.items)).toBe(true);
      
      // Check pagination structure
      expect(res.body.data.pagination).toBeDefined();
      expect(res.body.data.pagination.total_items).toBeDefined();
      expect(res.body.data.pagination.total_pages).toBeDefined();
      expect(res.body.data.pagination.current_page).toBeDefined();
      expect(res.body.data.pagination.limit).toBeDefined();
    });
  });

  describe('GET /api/pps/current', () => {
    it('should return current PPS for an authenticated user', async () => {
      const res = await request(app)
        .get('/api/pps/current')
        .set('Authorization', 'Bearer mock-token')
        .expect(200);
      
      // Verify response structure
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      
      // Validate basic PPS data
      expect(res.body.data.price_per_share).toBeDefined();
      expect(res.body.data.effective_date).toBeDefined();
    });
  });
  
  // Close database connections after all tests
  afterAll(async () => {
    // Close database connections if necessary
    if (app.locals.pool) {
      await app.locals.pool.end();
    }
  });
}); 