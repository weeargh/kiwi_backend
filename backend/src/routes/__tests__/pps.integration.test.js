/**
 * Integration test for Price Per Share (PPS) API endpoints
 * Tests the /api/pps endpoints with a live database connection to kiwi3_test
 */
const request = require('supertest');
const app = require('../../index');
const { pool } = require('../../config/db');
const { 
  validatePPSStructure, 
  MOCK_TENANT_ID 
} = require('../../__tests__/test-utils');

// Mock the auth middleware
jest.mock('../../middleware/auth');
const { checkJwt, syncUser, authorizeRole } = require('../../middleware/auth');

describe('Price Per Share (PPS) API', () => {
  // User data for admin and employee roles
  const adminUser = {
    id: '11111111-1111-1111-1111-111111111111', // Valid UUID for admin user
    tenantId: MOCK_TENANT_ID,
    role: 'admin'
  };
  
  const employeeUser = {
    id: '22222222-2222-2222-2222-222222222222', // Valid UUID for employee user
    tenantId: MOCK_TENANT_ID,
    role: 'employee'
  };

  // Test data for PPS entries
  const ppsEntries = [
    {
      effective_date: '2022-01-02',
      price_per_share: '10.000'
    },
    {
      effective_date: '2023-01-01',
      price_per_share: '15.500'
    },
    {
      effective_date: '2023-07-01',
      price_per_share: '17.750'
    }
  ];

  // Data for a new PPS entry to be used in POST test
  const newPPSEntry = {
    effective_date: '2024-01-02',
    price_per_share: '21.250'
  };
  
  // Setup: Create test PPS entries before tests
  beforeAll(async () => {
    // Mock auth0 middleware to provide admin user authentication
    checkJwt.mockImplementation((req, res, next) => {
      req.auth = { payload: { sub: 'auth0|admin' } };
      next();
    });
    
    syncUser.mockImplementation((req, res, next) => {
      req.user = adminUser;
      next();
    });
    
    authorizeRole.mockImplementation((roles) => {
      return (req, res, next) => {
        // Check if user's role is in the allowed roles
        if (!Array.isArray(roles)) {
          roles = [roles];
        }
        if (roles.includes(req.user.role)) {
          next();
        } else {
          res.status(403).json({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'Insufficient permissions'
            }
          });
        }
      };
    });

    // Clean any existing data for this tenant
    await pool.query(
      'DELETE FROM pps_history WHERE tenant_id = $1',
      [MOCK_TENANT_ID]
    );
    
    // Create test users if they don't exist
    const adminUserExists = await pool.query(
      'SELECT 1 FROM user_accounts WHERE user_id = $1',
      [adminUser.id]
    );
    
    if (adminUserExists.rows.length === 0) {
      await pool.query(`
        INSERT INTO user_accounts(user_id, tenant_id, email, name, role, status)
        VALUES($1, $2, $3, $4, $5, $6)
      `, [
        adminUser.id,
        MOCK_TENANT_ID,
        'admin@example.com',
        'Admin User',
        'admin',
        'active'
      ]);
    }
    
    const employeeUserExists = await pool.query(
      'SELECT 1 FROM user_accounts WHERE user_id = $1',
      [employeeUser.id]
    );
    
    if (employeeUserExists.rows.length === 0) {
      await pool.query(`
        INSERT INTO user_accounts(user_id, tenant_id, email, name, role, status)
        VALUES($1, $2, $3, $4, $5, $6)
      `, [
        employeeUser.id,
        MOCK_TENANT_ID,
        'employee@example.com',
        'Employee User',
        'employee',
        'active'
      ]);
    }
    
    // Insert test PPS entries
    for (const entry of ppsEntries) {
      await pool.query(`
        INSERT INTO pps_history(tenant_id, effective_date, price_per_share, created_by)
        VALUES($1, $2, $3, $4)
      `, [
        MOCK_TENANT_ID, 
        entry.effective_date, 
        parseFloat(entry.price_per_share), 
        adminUser.id
      ]);
    }
  });
  
  // Clean up after all tests
  afterAll(async () => {
    // Clean up data for the tenant
    await pool.query(
      'DELETE FROM pps_history WHERE tenant_id = $1',
      [MOCK_TENANT_ID]
    );
    
    // Clean up test users (but only the ones we created for this test)
    await pool.query(
      'DELETE FROM user_accounts WHERE user_id = ANY($1)',
      [[adminUser.id, employeeUser.id]]
    );
    
    await pool.end();
  });
  
  describe('GET /api/pps/current', () => {
    it('should return the currently effective PPS for an admin user', async () => {
      // Set up mock to use admin user
      syncUser.mockImplementation((req, res, next) => {
        req.user = adminUser;
        next();
      });
      
      // Mock the current date to be 2023-10-01 for consistent testing
      const realDate = Date;
      global.Date = class extends Date {
        constructor() {
          super();
          if (arguments.length === 0) {
            return new realDate('2023-10-01T00:00:00Z');
          }
          return new realDate(...arguments);
        }
        static now() {
          return new realDate('2023-10-01T00:00:00Z').getTime();
        }
      };
      
      const response = await request(app)
        .get('/api/pps/current')
        .expect('Content-Type', /json/)
        .expect(200);
      
      // Restore Date
      global.Date = realDate;
      
      // Verify response format
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      
      // Validate PPS structure
      validatePPSStructure(response.body.data);
      
      // Verify the returned data matches what we expect
      // Should be the latest PPS before the current date (2023-10-01)
      expect(response.body.data.tenant_id).toBe(MOCK_TENANT_ID);
      
      // Compare dates by checking if they're the same day, regardless of timezone
      const effectiveDate = new Date(response.body.data.effective_date);
      const expectedDate = new Date('2023-07-01');
      expect(
        effectiveDate.getFullYear() === expectedDate.getFullYear() &&
        effectiveDate.getMonth() === expectedDate.getMonth() &&
        (effectiveDate.getDate() === expectedDate.getDate() || effectiveDate.getDate() === expectedDate.getDate()+1)
      ).toBe(true);
      
      expect(response.body.data.price_per_share).toBe('17.750');
    });
    
    it('should return the currently effective PPS for an employee user', async () => {
      // Set up mock to use employee user
      syncUser.mockImplementation((req, res, next) => {
        req.user = employeeUser;
        next();
      });
      
      // Mock the current date to be 2023-10-01 for consistent testing
      const realDate = Date;
      global.Date = class extends Date {
        constructor() {
          super();
          if (arguments.length === 0) {
            return new realDate('2023-10-01T00:00:00Z');
          }
          return new realDate(...arguments);
        }
        static now() {
          return new realDate('2023-10-01T00:00:00Z').getTime();
        }
      };
      
      const response = await request(app)
        .get('/api/pps/current')
        .expect('Content-Type', /json/)
        .expect(200);
      
      // Restore Date
      global.Date = realDate;
      
      // Verify response format
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      
      // Validate PPS structure
      validatePPSStructure(response.body.data);
    });
  });
  
  describe('GET /api/pps', () => {
    it('should list all PPS entries with pagination for an admin user', async () => {
      // Set up mock to use admin user
      syncUser.mockImplementation((req, res, next) => {
        req.user = adminUser;
        next();
      });
      
      const response = await request(app)
        .get('/api/pps')
        .expect('Content-Type', /json/)
        .expect(200);
      
      // Verify response format
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.items).toBeDefined();
      expect(Array.isArray(response.body.data.items)).toBe(true);
      
      // Should have 3 entries
      expect(response.body.data.items.length).toBe(3);
      
      // Verify pagination data
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.total_items).toBe(3);
      expect(response.body.data.pagination.current_page).toBe(1);
      
      // Validate each PPS structure
      response.body.data.items.forEach(pps => {
        validatePPSStructure(pps);
      });
      
      // Verify the entries are in the correct order (most recent effective_date first)
      // Compare dates flexibly to account for timezone differences
      const dates = response.body.data.items.map(item => new Date(item.effective_date));
      
      // Check that items are in the right order (descending by date)
      expect(dates[0] > dates[1]).toBe(true);
      expect(dates[1] > dates[2]).toBe(true);
      
      // Check approximate dates (first month of each year)
      expect(dates[0].getFullYear()).toBe(2023);
      expect(dates[0].getMonth()).toBe(6); // July is month 6 (0-indexed)
      
      expect(dates[1].getFullYear()).toBe(2023);
      expect(dates[1].getMonth()).toBe(0); // January is month 0
      
      expect(dates[2].getFullYear()).toBe(2022);
      expect(dates[2].getMonth()).toBe(0); // January is month 0
    });
    
    it('should list PPS entries within a date range', async () => {
      // Set up mock to use admin user
      syncUser.mockImplementation((req, res, next) => {
        req.user = adminUser;
        next();
      });
      
      const response = await request(app)
        .get('/api/pps')
        .query({ from_date: '2023-01-01', to_date: '2023-12-31' })
        .expect('Content-Type', /json/)
        .expect(200);
      
      // Verify response format
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.items).toBeDefined();
      expect(Array.isArray(response.body.data.items)).toBe(true);
      
      // Should have 2 entries within this date range
      expect(response.body.data.items.length).toBe(2);
      
      // Validate each PPS structure
      response.body.data.items.forEach(pps => {
        validatePPSStructure(pps);
        
        // Get the effective date components
        const effectiveDate = new Date(pps.effective_date);
        const year = effectiveDate.getFullYear();
        
        // Check if the date is within 2023 (the year range we're looking for)
        expect(year).toBe(2023);
      });
    });
    
    it('should allow employees to view PPS entries', async () => {
      // Set up mock to use employee user
      syncUser.mockImplementation((req, res, next) => {
        req.user = employeeUser;
        next();
      });
      
      const response = await request(app)
        .get('/api/pps')
        .expect('Content-Type', /json/)
        .expect(200);
      
      // Verify response format
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.items).toBeDefined();
      expect(Array.isArray(response.body.data.items)).toBe(true);
      
      // Verify pagination data
      expect(response.body.data.pagination).toBeDefined();
      
      // Validate each PPS structure
      response.body.data.items.forEach(pps => {
        validatePPSStructure(pps);
      });
    });
  });
  
  describe('POST /api/pps', () => {
    it('should allow an admin to create a new PPS entry', async () => {
      // Set up mock to use admin user
      syncUser.mockImplementation((req, res, next) => {
        req.user = adminUser;
        next();
      });
      
      const response = await request(app)
        .post('/api/pps')
        .send(newPPSEntry)
        .expect('Content-Type', /json/)
        .expect(201);
      
      // Verify response format
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      
      // Validate PPS structure
      validatePPSStructure(response.body.data);
      
      // Verify the PPS data
      expect(response.body.data.tenant_id).toBe(MOCK_TENANT_ID);
      
      // Compare dates flexibly to account for timezone differences
      const effectiveDate = new Date(response.body.data.effective_date);
      const expectedDate = new Date(newPPSEntry.effective_date);
      
      expect(effectiveDate.getFullYear()).toBe(expectedDate.getFullYear());
      expect(effectiveDate.getMonth()).toBe(expectedDate.getMonth());
      expect(
        effectiveDate.getDate() === expectedDate.getDate() || 
        effectiveDate.getDate() === expectedDate.getDate()-1
      ).toBe(true);
      
      expect(response.body.data.price_per_share).toBe(newPPSEntry.price_per_share);
      expect(response.body.data.created_by).toBe(adminUser.id);
    });
    
    it('should not allow employees to create PPS entries', async () => {
      // Set up mock to use employee user
      syncUser.mockImplementation((req, res, next) => {
        req.user = employeeUser;
        next();
      });
      
      const response = await request(app)
        .post('/api/pps')
        .send(newPPSEntry)
        .expect('Content-Type', /json/)
        .expect(403);
      
      // Verify response format
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
    
    it('should validate PPS entry fields', async () => {
      // Set up mock to use admin user
      syncUser.mockImplementation((req, res, next) => {
        req.user = adminUser;
        next();
      });
      
      // Test with missing effective_date
      let response = await request(app)
        .post('/api/pps')
        .send({ price_per_share: '25.000' })
        .expect('Content-Type', /json/)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('BAD_REQUEST');
      
      // Test with negative price_per_share
      response = await request(app)
        .post('/api/pps')
        .send({ effective_date: '2024-06-01', price_per_share: '-5.000' })
        .expect('Content-Type', /json/)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('BAD_REQUEST');
    });
  });
}); 