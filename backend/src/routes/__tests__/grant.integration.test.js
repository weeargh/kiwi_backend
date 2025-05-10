/**
 * Integration test for Grant API endpoints
 * Uses transaction rollbacks for test isolation
 */
const IntegrationTestBase = require('../../__tests__/integration-test-base');
const { v4: uuidv4 } = require('uuid');
const { validateGrantStructure } = require('../../__tests__/test-utils');

// Define expected date format helper
const formatDate = (date) => {
  return new Date(date).toISOString().split('T')[0];
};

class GrantApiTest extends IntegrationTestBase {
  constructor() {
    super();
    this.basePath = '/api/grants';
  }

  /**
   * Create test grant data
   * @param {Object} employee - Employee to associate grant with
   * @param {Object} overrides - Properties to override in test grant
   * @returns {Object} - Grant data for testing
   */
  createTestGrantData(employee, overrides = {}) {
    return {
      employee_id: employee.employee_id,
      grant_date: overrides.grant_date || '2025-01-01',
      share_amount: overrides.share_amount || '100.000',
      notes: overrides.notes || 'Test grant',
      ...overrides
    };
  }

  /**
   * Create a test grant in the database
   * @param {Object} employeeData - Employee data or ID
   * @param {Object} grantData - Grant data
   * @returns {Promise<Object>} - Created grant
   */
  async createTestGrant(employeeData, grantData = {}) {
    // Get or create employee
    let employee;
    if (typeof employeeData === 'string') {
      // If employee_id is provided
      const result = await this.query(
        'SELECT * FROM employees WHERE employee_id = $1',
        [employeeData]
      );
      employee = result.rows[0];
    } else if (employeeData.employee_id) {
      employee = employeeData;
    } else {
      // Create a new test employee
      employee = await this.createTestEmployee(employeeData);
    }

    // Ensure pool exists with enough available shares
    const poolResult = await this.query(
      `SELECT * FROM equity_pools WHERE tenant_id = $1`,
      [this.MOCK_TENANT_ID]
    );
    
    let poolId;
    if (poolResult.rows.length === 0) {
      // Create a new pool if none exists
      const pool = await this.createTestPool({
        initial_amount: '1000.000',
        created_by: this.defaultAdminId
      });
      poolId = pool.pool_id;
      
      // Create initial pool event
      await this.query(
        `INSERT INTO pool_events (pool_id, tenant_id, event_type, amount, effective_date, notes, created_by)
         VALUES ($1, $2, $3, $4, NOW()::DATE, $5, $6)`,
        [
          poolId,
          this.MOCK_TENANT_ID,
          'initial',
          '1000.000',
          'Initial pool creation',
          this.defaultAdminId
        ]
      );
    } else {
      poolId = poolResult.rows[0].pool_id;
    }

    // Calculate grant values
    const grantId = grantData.grant_id || uuidv4();
    const shareAmount = grantData.share_amount || '100.000';
    const grantDate = grantData.grant_date || '2025-01-01';
    
    // Insert grant
    const result = await this.query(
      `INSERT INTO grants (
        grant_id, tenant_id, employee_id, grant_date, share_amount, vested_amount,
        status, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        grantId,
        this.MOCK_TENANT_ID,
        employee.employee_id,
        grantDate,
        shareAmount,
        '0.000', // Initial vested_amount is 0
        'active',
        grantData.notes || 'Test grant',
        grantData.created_by || this.defaultAdminId
      ]
    );
    
    return result.rows[0];
  }
}

// Create test instance
const testBase = new GrantApiTest();

describe('Grant API', () => {
  // Start transaction before each test for isolation
  beforeEach(async () => {
    await testBase.setup();
  });
  
  // Roll back transaction after each test
  afterEach(async () => {
    await testBase.cleanup();
  });
  
  describe('GET /api/grants', () => {
    it('should return a list of grants for an admin user', async () => {
      // Create test employee
      const employee = await testBase.createTestEmployee();
      
      // Create multiple test grants
      const grant1 = await testBase.createTestGrant(employee, {
        grant_date: '2025-01-01',
        share_amount: '100.000'
      });
      
      const grant2 = await testBase.createTestGrant(employee, {
        grant_date: '2025-02-01',
        share_amount: '200.000'
      });
      
      // Make authenticated request as admin
      const response = await testBase
        .getAuthenticatedRequest(testBase.defaultAdminId, 'admin')
        .get(testBase.basePath)
        .expect('Content-Type', /json/)
        .expect(200);
      
      // Verify response format
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
      
      // Verify the returned grants include our test grants
      const grantIds = response.body.data.map(g => g.grant_id);
      expect(grantIds).toContain(grant1.grant_id);
      expect(grantIds).toContain(grant2.grant_id);
      
      // Validate first grant structure
      const returnedGrant = response.body.data.find(g => g.grant_id === grant1.grant_id);
      expect(returnedGrant).toBeDefined();
      if (validateGrantStructure) {
        validateGrantStructure(returnedGrant);
      } else {
        // Fallback validation if helper doesn't exist
        expect(returnedGrant.employee_id).toBe(employee.employee_id);
        expect(returnedGrant.share_amount).toBe('100.000');
        expect(returnedGrant.status).toBe('active');
      }
    });
    
    it('should filter grants by employee_id when specified', async () => {
      // Create two test employees
      const employee1 = await testBase.createTestEmployee();
      const employee2 = await testBase.createTestEmployee();
      
      // Create grants for both employees
      await testBase.createTestGrant(employee1, {
        grant_date: '2025-01-01',
        share_amount: '100.000'
      });
      
      await testBase.createTestGrant(employee2, {
        grant_date: '2025-02-01',
        share_amount: '200.000'
      });
      
      // Make authenticated request with employee filter
      const response = await testBase
        .getAuthenticatedRequest(testBase.defaultAdminId, 'admin')
        .get(`${testBase.basePath}?employee_id=${employee1.employee_id}`)
        .expect('Content-Type', /json/)
        .expect(200);
      
      // Verify filtered response
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      
      // Verify only grants for employee1 are returned
      expect(response.body.data.every(g => g.employee_id === employee1.employee_id)).toBe(true);
      expect(response.body.data.some(g => g.employee_id === employee2.employee_id)).toBe(false);
    });
    
    it('should return only active grants when status=active is specified', async () => {
      // Create test employee
      const employee = await testBase.createTestEmployee();
      
      // Create one active grant
      const activeGrant = await testBase.createTestGrant(employee, {
        grant_date: '2025-01-01',
        share_amount: '100.000'
      });
      
      // Create one inactive grant
      const inactiveGrant = await testBase.createTestGrant(employee, {
        grant_date: '2025-02-01',
        share_amount: '200.000'
      });
      
      // Set the second grant to inactive
      await testBase.query(
        'UPDATE grants SET status = $1 WHERE grant_id = $2',
        ['inactive', inactiveGrant.grant_id]
      );
      
      // Make authenticated request with status filter
      const response = await testBase
        .getAuthenticatedRequest(testBase.defaultAdminId, 'admin')
        .get(`${testBase.basePath}?status=active`)
        .expect('Content-Type', /json/)
        .expect(200);
      
      // Verify filtered response
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      
      // Verify only active grants are returned
      expect(response.body.data.every(g => g.status === 'active')).toBe(true);
      
      // Verify active grant is included and inactive is not
      const returnedGrantIds = response.body.data.map(g => g.grant_id);
      expect(returnedGrantIds).toContain(activeGrant.grant_id);
      expect(returnedGrantIds).not.toContain(inactiveGrant.grant_id);
    });
  });
  
  describe('POST /api/grants', () => {
    it('should create a new grant as an admin user', async () => {
      // Create test employee
      const employee = await testBase.createTestEmployee();
      
      // Create test pool with sufficient shares
      await testBase.createTestPool({
        initial_amount: '1000.000',
        created_by: testBase.defaultAdminId
      });
      
      // Prepare grant data
      const grantData = testBase.createTestGrantData(employee, {
        grant_date: '2025-03-15',
        share_amount: '150.000',
        notes: 'New hire equity grant'
      });
      
      // Make authenticated request to create grant
      const response = await testBase
        .getAuthenticatedRequest(testBase.defaultAdminId, 'admin')
        .post(testBase.basePath)
        .send(grantData)
        .expect('Content-Type', /json/)
        .expect(201);
      
      // Verify response format
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      
      // Validate created grant
      const createdGrant = response.body.data;
      expect(createdGrant.employee_id).toBe(employee.employee_id);
      expect(createdGrant.share_amount).toBe('150.000');
      expect(createdGrant.vested_amount).toBe('0.000');
      expect(createdGrant.status).toBe('active');
      expect(formatDate(createdGrant.grant_date)).toBe('2025-03-15');
      expect(createdGrant.notes).toBe('New hire equity grant');
      
      // Verify grant is in the database
      const dbResult = await testBase.query(
        'SELECT * FROM grants WHERE grant_id = $1',
        [createdGrant.grant_id]
      );
      
      expect(dbResult.rows.length).toBe(1);
    });
    
    it('should return 403 for employee trying to create a grant', async () => {
      // Create test employee
      const employee = await testBase.createTestEmployee();
      
      // Prepare grant data
      const grantData = testBase.createTestGrantData(employee);
      
      // Make authenticated request as employee (should fail)
      const response = await testBase
        .getAuthenticatedRequest(testBase.defaultEmployeeId, 'employee')
        .post(testBase.basePath)
        .send(grantData)
        .expect('Content-Type', /json/)
        .expect(403);
      
      // Verify error response
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
    
    it('should return 400 if available shares are insufficient', async () => {
      // Create test employee
      const employee = await testBase.createTestEmployee();
      
      // Create test pool with small amount of shares
      await testBase.createTestPool({
        initial_amount: '50.000',
        created_by: testBase.defaultAdminId
      });
      
      // Prepare grant data with more shares than available
      const grantData = testBase.createTestGrantData(employee, {
        share_amount: '100.000'
      });
      
      // Make authenticated request (should fail)
      const response = await testBase
        .getAuthenticatedRequest(testBase.defaultAdminId, 'admin')
        .post(testBase.basePath)
        .send(grantData)
        .expect('Content-Type', /json/)
        .expect(400);
      
      // Verify error response
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('INSUFFICIENT_SHARES');
    });
  });
  
  // Additional test scenarios would follow the same pattern
});
