jest.mock('../middleware/auth');
const request = require('supertest');
const app = require('../test-index');
const { checkJwt } = require('../middleware/auth');

const { pool } = require('../config/db');
const { MOCK_TENANT_ID, MOCK_POOL_ID } = require('./test-utils');

describe('Pool API', () => {
    // Seed the equity_pools table before all tests
  beforeAll(async () => {
    await pool.query(
      `INSERT INTO equity_pools (pool_id, tenant_id, initial_amount, total_pool, created_by, created_at)
       VALUES ($1, $2, $3, $3, $4, NOW())
       ON CONFLICT (pool_id) DO NOTHING`,
      [MOCK_POOL_ID, MOCK_TENANT_ID, '100000.000', 'test-user-id-123']
    );
  });

  // Clean up the equity_pools table after each test
  afterEach(async () => {
    await pool.query('DELETE FROM equity_pools WHERE pool_id = $1', [MOCK_POOL_ID]);
  });

  // Reset mocks before each test
  beforeEach(() => {
    // Ensure checkJwt is set to successful authentication mode
    checkJwt.resetToSuccess();
  });

  describe('GET /api/pools', () => {
    it('should return pool metrics for an authenticated user', async () => {
      const res = await request(app)
        .get('/api/pools')
        .set('Authorization', 'Bearer mock-token')
        .expect(200);
      
      // Verify response structure
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      
      // Validate basic pool metrics
      expect(res.body.data.initial_amount).toBeDefined();
      expect(res.body.data.total_pool).toBeDefined();
      expect(res.body.data.granted_shares).toBeDefined();
      expect(res.body.data.returned_shares).toBeDefined();
      expect(res.body.data.available_shares).toBeDefined();
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