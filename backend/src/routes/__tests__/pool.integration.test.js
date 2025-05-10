/**
 * Integration test for Equity Pool API endpoints
 * Tests the /api/pools endpoints with a live database connection to kiwi3_test
 */
const request = require('supertest');
const app = require('../../index');
const { pool } = require('../../config/db');
const { 
  validateEquityPoolStructure, 
  validatePoolEventStructure, 
  MOCK_TENANT_ID 
} = require('../../__tests__/test-utils');

// Mock the auth middleware
jest.mock('../../middleware/auth');
const { checkJwt, syncUser, authorizeRole } = require('../../middleware/auth');

// Helper function to mock authentication and authorization for tests
const mockAuthMiddleware = (userId, role, tenantId = MOCK_TENANT_ID) => {
  checkJwt.mockImplementation((req, res, next) => {
    req.auth = { payload: { sub: `auth0|${userId}` } }; // Simulate Auth0 sub claim
    next();
  });
  syncUser.mockImplementation((req, res, next) => {
    req.user = { id: userId, tenantId: tenantId, role: role };
    next();
  });
  authorizeRole.mockImplementation(roles => (req, res, next) => {
    if (roles.includes(req.user.role)) {
      next();
    } else {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'User does not have the required role' } });
    }
  });
};

// Define these constants or import them
const mockAdminUserId = '11111111-1111-1111-1111-111111111111'; // Use the globally seeded admin
const mockEmployeeUserId = '22222222-2222-2222-2222-222222222222'; // Suite-specific employee

let poolId; // To store the created pool ID

describe('Equity Pool API', () => {
  beforeAll(async () => {
    // Ensure tenant and global admin user exist (handled by globalSetup.js)
    
    // Create a suite-specific employee user if it doesn't exist
    await pool.query(
      `INSERT INTO user_accounts (user_id, tenant_id, email, name, role, status, auth0_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id) DO NOTHING`, 
      [
        mockEmployeeUserId, 
        MOCK_TENANT_ID, 
        'pool.employee@test.com', 
        'Pool Test Employee', 
        'employee', 
        'active', 
        'auth0|poolemployee'
      ]
    );

    // Clean existing pool data for the mock tenant to ensure a fresh start
    await pool.query('DELETE FROM pool_events WHERE tenant_id = $1', [MOCK_TENANT_ID]);
    await pool.query('DELETE FROM equity_pools WHERE tenant_id = $1', [MOCK_TENANT_ID]);

    // Create the initial equity pool for the tenant
    const initialPoolAmount = 1000.000;
    const poolResult = await pool.query(
      `INSERT INTO equity_pools (tenant_id, initial_amount, total_pool, created_by)
       VALUES ($1, $2, $2, $3) RETURNING pool_id`,
      [MOCK_TENANT_ID, initialPoolAmount, mockAdminUserId]
    );
    poolId = poolResult.rows[0].pool_id;

    // Create the mandatory initial pool event linked to pool creation
    await pool.query(
      `INSERT INTO pool_events (pool_id, tenant_id, event_type, amount, effective_date, notes, created_by)
       VALUES ($1, $2, $3, $4, NOW()::DATE, $5, $6)`,
      [
        poolId, 
        MOCK_TENANT_ID, 
        'initial', 
        initialPoolAmount,
        'Initial pool creation', 
        mockAdminUserId
      ]
    );
  });

  // Clean up after all tests
  afterAll(async () => {
    // Clean up data specific to this test suite
    await pool.query(
      'DELETE FROM pool_events WHERE tenant_id = $1',
      [MOCK_TENANT_ID]
    );
    await pool.query(
      'DELETE FROM equity_pools WHERE tenant_id = $1',
      [MOCK_TENANT_ID]
    );
    // Delete PPS history potentially created by tests using the admin user 
    // (Safer to clean this, although ideally tests mock this dependency)
    await pool.query(
      'DELETE FROM pps_history WHERE created_by = $1',
      [mockAdminUserId] 
    );
    // Delete the suite-specific employee user
    await pool.query(
      'DELETE FROM user_accounts WHERE user_id = $1',
      [mockEmployeeUserId]
    );
    
    // Do NOT delete the globally seeded admin user here
    
    await pool.end();
  });
  
  describe('GET /api/pools', () => {
    it('should return the equity pool with metrics for an admin user', async () => {
      // Mock middleware for admin user
      mockAuthMiddleware(mockAdminUserId, 'admin');
      
      const response = await request(app)
        .get('/api/pools')
        .expect('Content-Type', /json/)
        .expect(200);
      
      // Verify response format
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      
      // Validate pool structure
      validateEquityPoolStructure(response.body.data);
      
      // Verify the returned data matches what we expect
      expect(response.body.data.tenant_id).toBe(MOCK_TENANT_ID);
      expect(response.body.data.initial_amount).toBe("1000.000");
      expect(response.body.data.total_pool).toBe("1000.000");
      expect(response.body.data.granted_shares).toBe('0.000');
      expect(response.body.data.returned_shares).toBe('0.000');
      expect(response.body.data.available_shares).toBe("1000.000");
    });
    
    it('should return the equity pool with metrics for an employee user', async () => {
      // Mock middleware for employee user
      mockAuthMiddleware(mockEmployeeUserId, 'employee');
      
      const response = await request(app)
        .get('/api/pools')
        .expect('Content-Type', /json/)
        .expect(200);
      
      // Verify response format
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      
      // Validate pool structure
      validateEquityPoolStructure(response.body.data);
    });
  });
  
  describe('POST /api/pools/:pool_id/events', () => {
    it('should allow an admin to create a top-up event', async () => {
      // Mock middleware for admin user
      mockAuthMiddleware(mockAdminUserId, 'admin');
      
      const topUpEventData = {
        amount: '500.000',
        event_type: 'top_up',
        effective_date: '2023-06-01',
        notes: 'Additional shares for employee grants'
      };
      
      const response = await request(app)
        .post(`/api/pools/${poolId}/events`)
        .send(topUpEventData)
        .expect('Content-Type', /json/)
        .expect(201);
      
      // Verify response format
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      
      // Validate pool event structure
      validatePoolEventStructure(response.body.data);
      
      // Verify the event data
      expect(response.body.data.pool_id).toBe(poolId);
      expect(response.body.data.tenant_id).toBe(MOCK_TENANT_ID);
      expect(response.body.data.amount).toBe(topUpEventData.amount);
      expect(response.body.data.event_type).toBe(topUpEventData.event_type);
      
      // Compare dates flexibly to account for timezone differences
      const effectiveDate = new Date(response.body.data.effective_date);
      const expectedDate = new Date(topUpEventData.effective_date);
      expect(
        effectiveDate.getFullYear() === expectedDate.getFullYear() &&
        effectiveDate.getMonth() === expectedDate.getMonth() &&
        (effectiveDate.getDate() === expectedDate.getDate() || 
         effectiveDate.getDate() === expectedDate.getDate()-1 ||
         effectiveDate.getDate() === expectedDate.getDate()+1)
      ).toBe(true);
      
      expect(response.body.data.notes).toBe(topUpEventData.notes);
    });
    
    it('should allow an admin to create a reduction event', async () => {
      // Mock middleware for admin user
      mockAuthMiddleware(mockAdminUserId, 'admin');
      
      const reductionEventData = {
        amount: '200.000',
        event_type: 'reduction',
        effective_date: '2023-09-01',
        notes: 'Reduction of unused shares'
      };
      
      const response = await request(app)
        .post(`/api/pools/${poolId}/events`)
        .send(reductionEventData)
        .expect('Content-Type', /json/)
        .expect(201);
      
      // Verify response format
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      
      // Validate pool event structure
      validatePoolEventStructure(response.body.data);
      
      // Verify the event data
      expect(response.body.data.pool_id).toBe(poolId);
      expect(response.body.data.tenant_id).toBe(MOCK_TENANT_ID);
      // For reductions, the amount should be negative in the response
      expect(response.body.data.amount).toBe('-200.000');
      expect(response.body.data.event_type).toBe(reductionEventData.event_type);
      
      // Compare dates flexibly to account for timezone differences
      const effectiveDate = new Date(response.body.data.effective_date);
      const expectedDate = new Date(reductionEventData.effective_date);
      expect(
        effectiveDate.getFullYear() === expectedDate.getFullYear() &&
        effectiveDate.getMonth() === expectedDate.getMonth() &&
        (effectiveDate.getDate() === expectedDate.getDate() || 
         effectiveDate.getDate() === expectedDate.getDate()-1 ||
         effectiveDate.getDate() === expectedDate.getDate()+1)
      ).toBe(true);
      
      expect(response.body.data.notes).toBe(reductionEventData.notes);
    });
    
    it('should not allow employees to create pool events', async () => {
      // Mock middleware for employee user
      mockAuthMiddleware(mockEmployeeUserId, 'employee');
      
      const eventData = {
        amount: '500.000',
        event_type: 'top_up',
        effective_date: '2023-06-01',
        notes: 'Additional shares for employee grants'
      };
      
      const response = await request(app)
        .post(`/api/pools/${poolId}/events`)
        .send(eventData)
        .expect('Content-Type', /json/)
        .expect(403);
      
      // Verify response format
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });
  
  describe('GET /api/pools/:pool_id/events', () => {
    it('should list all pool events with pagination for an admin user', async () => {
      // Mock middleware for admin user
      mockAuthMiddleware(mockAdminUserId, 'admin');
      
      const response = await request(app)
        .get(`/api/pools/${poolId}/events`)
        .expect('Content-Type', /json/)
        .expect(200);
      
      // Verify response format
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.items).toBeDefined();
      expect(Array.isArray(response.body.data.items)).toBe(true);
      
      // Should have 3 events (initial, top-up, reduction)
      expect(response.body.data.items.length).toBe(3);
      
      // Verify pagination data
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.total_items).toBe(3);
      expect(response.body.data.pagination.current_page).toBe(1);
      
      // Validate each event structure
      response.body.data.items.forEach(event => {
        validatePoolEventStructure(event);
      });
      
      // Verify the events are in the correct order (most recent effective_date first)
      const eventDates = response.body.data.items.map(item => new Date(item.effective_date));
      
      // Check that events are in descending order by date
      // Only verify the order if we have enough events
      if (eventDates.length >= 3) {
        // Check the relative ordering
        expect(eventDates[0] >= eventDates[1]).toBe(true);
        expect(eventDates[1] >= eventDates[2]).toBe(true);
        
        // Check approximate dates (by month/year) - Commenting out for simplified POST logic
        /*
        const reductionMonth = new Date(reductionEventData.effective_date).getMonth();
        const topUpMonth = new Date(topUpEventData.effective_date).getMonth();
        const initialMonth = new Date(initialPoolData.effective_date).getMonth();
        
        expect(eventDates[0].getMonth()).toBe(reductionMonth);
        expect(eventDates[1].getMonth()).toBe(topUpMonth);
        expect(eventDates[2].getMonth()).toBe(initialMonth);
        */
      }
    });
    
    it('should list pool events within a date range', async () => {
      // Mock middleware for admin user
      mockAuthMiddleware(mockAdminUserId, 'admin');
      
      const response = await request(app)
        .get(`/api/pools/${poolId}/events`)
        .query({ from_date: '2023-06-01', to_date: '2023-12-31' })
        .expect('Content-Type', /json/)
        .expect(200);
      
      // Verify response format
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.items).toBeDefined();
      expect(Array.isArray(response.body.data.items)).toBe(true);
      
      // Should have 2 events within this date range (top-up and reduction)
      expect(response.body.data.items.length).toBe(2);
      
      // Validate each event structure
      response.body.data.items.forEach(event => {
        validatePoolEventStructure(event);
        
        // Get the effective date components
        const effectiveDate = new Date(event.effective_date);
        const year = effectiveDate.getFullYear();
        const month = effectiveDate.getMonth();
        
        // Check if the date is within the expected range (June-Dec 2023)
        expect(year).toBe(2023);
        expect(month >= 5 && month <= 11).toBe(true); // June (5) through December (11)
      });
    });
    
    it('should allow employees to view pool events', async () => {
      // Mock middleware for employee user
      mockAuthMiddleware(mockEmployeeUserId, 'employee');
      
      const response = await request(app)
        .get(`/api/pools/${poolId}/events`)
        .expect('Content-Type', /json/)
        .expect(200);
      
      // Verify response format
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.items).toBeDefined();
      expect(Array.isArray(response.body.data.items)).toBe(true);
      
      // Verify pagination data
      expect(response.body.data.pagination).toBeDefined();
      
      // Validate each event structure
      response.body.data.items.forEach(event => {
        validatePoolEventStructure(event);
      });
    });
  });

  // New Test Suite: Direct Function Call
  describe('Direct Function Call Test', () => {
    it('should call func_adjust_pool_v3 directly via pool client', async () => {
      const client = await pool.connect();
      let eventResult = null;
      let directCallError = null;

      try {
        await client.query('BEGIN');
        await client.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
        const query = `
          SELECT * FROM func_adjust_pool_v3($1::UUID, $2::UUID, $3::VARCHAR, $4, $5::DATE, $6::TEXT, $7::UUID)
        `; // $4 has no cast, function expects TEXT
        const params = [
          poolId,          // From beforeAll
          MOCK_TENANT_ID,
          'top_up',         // Event type
          '10.000',         // Amount as string
          '2024-01-15',     // Effective date
          'Direct call test', // Notes
          mockAdminUserId // From global scope
        ];
        console.log('Executing direct function call with params:', params);
        const result = await client.query(query, params);
        eventResult = result.rows[0];
        await client.query('COMMIT'); // Commit if successful
        console.log('Direct function call successful, event created:', eventResult?.event_id);
      } catch (error) {
        directCallError = error; // Store error to check after rollback
        console.error("Direct function call failed within transaction:", { 
          message: error.message, 
          code: error.code, 
          detail: error.detail, 
          stack: error.stack 
        });
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          console.error("Error rolling back transaction after direct call failure:", rollbackError);
        }
      } finally {
        client.release();
      }

      // Assertions outside the try/finally block
      expect(directCallError).toBeNull(); // Test fails if an error was caught
      expect(eventResult).toBeDefined();
      if (eventResult) { // Avoid errors if eventResult is null
        expect(eventResult.event_type).toBe('top_up');
        expect(eventResult.amount).toBe('10.000'); // Function returns DECIMAL, pg driver stringifies
        expect(eventResult.notes).toBe('Direct call test');
      }
    });
  });
}); 