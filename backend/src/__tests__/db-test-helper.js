/**
 * Database Testing Helper
 * 
 * Provides utilities for managing test database state:
 * - Transaction support for test isolation
 * - Consistent test fixtures
 * - Data reset between tests
 * - Separate pools for different test types
 */

const { testPool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { MOCK_TENANT_ID } = require('./test-utils');

/**
 * Database test helper that provides transaction support and consistent test data
 */
class DbTestHelper {
  constructor(pool = testPool) {
    this.pool = pool;
    this.client = null;
    this.transactionActive = false;
  }

  /**
   * Start a transaction for test isolation
   * Call this in beforeEach() to isolate database changes for each test
   */
  async startTransaction() {
    if (this.transactionActive) {
      throw new Error('Transaction already started');
    }
    
    this.client = await this.pool.connect();
    await this.client.query('BEGIN');
    this.transactionActive = true;
    
    return this.client;
  }

  /**
   * Rollback the transaction to isolate tests
   * Call this in afterEach() to clean up changes from each test
   */
  async rollbackTransaction() {
    if (!this.transactionActive || !this.client) {
      return;
    }
    
    await this.client.query('ROLLBACK');
    this.client.release();
    this.client = null;
    this.transactionActive = false;
  }

  /**
   * Execute a query within the transaction if active, or using the pool if not
   * @param {string} text - SQL query text
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} - Query result
   */
  async query(text, params = []) {
    if (this.transactionActive && this.client) {
      return this.client.query(text, params);
    }
    return this.pool.query(text, params);
  }

  /**
   * Reset all test data in the database
   * Use with caution - this deletes all data but keeps table structure
   */
  async resetAllData() {
    // Use a specific client for resetting data, not the transaction client
    const resetClient = await this.pool.connect();
    
    try {
      // Disable foreign key checks before truncating
      await resetClient.query('SET session_replication_role = replica;');
      
      // Get all tables
      const tablesResult = await resetClient.query(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public';"
      );
      
      // Truncate each table in reverse order to handle dependencies
      for (const row of tablesResult.rows.reverse()) {
        await resetClient.query(`TRUNCATE TABLE "${row.tablename}" CASCADE;`);
      }
      
      // Re-enable foreign key checks
      await resetClient.query('SET session_replication_role = DEFAULT;');
      
      // Seed test data
      await this.seedTestData(resetClient);
      
    } finally {
      resetClient.release();
    }
  }

  /**
   * Seed baseline test data that most tests will need
   * @param {Object} client - Database client to use
   */
  async seedTestData(client) {
    const queryClient = client || this.client || this.pool;
    
    // Insert default tenant
    await queryClient.query(
      `INSERT INTO tenants (tenant_id, name, currency, timezone) 
       VALUES ($1, 'Test Company', 'USD', 'America/New_York')
       ON CONFLICT (tenant_id) DO NOTHING`,
      [MOCK_TENANT_ID]
    );
    
    // Insert default admin user
    const adminId = uuidv4();
    await queryClient.query(
      `INSERT INTO user_accounts (user_id, tenant_id, auth0_user_id, email, name, role, status) 
       VALUES ($1, $2, 'auth0|admin', 'admin@test.com', 'Test Admin', 'admin', 'active')
       ON CONFLICT (tenant_id, email) WHERE deleted_at IS NULL DO NOTHING`,
      [adminId, MOCK_TENANT_ID]
    );
    
    // More seed data can be added as needed
  }
  
  /**
   * Create a test tenant with optional custom properties
   * @param {Object} overrides - Properties to override
   * @returns {Promise<Object>} - Created tenant record
   */
  async createTestTenant(overrides = {}) {
    const tenantId = overrides.tenant_id || uuidv4();
    const result = await this.query(
      `INSERT INTO tenants (tenant_id, name, currency, timezone)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        tenantId,
        overrides.name || 'Test Tenant',
        overrides.currency || 'USD',
        overrides.timezone || 'America/New_York'
      ]
    );
    
    return result.rows[0];
  }
  
  /**
   * Create a test user with optional custom properties
   * @param {string} role - User role (admin or employee)
   * @param {Object} overrides - Properties to override
   * @returns {Promise<Object>} - Created user record
   */
  async createTestUser(role = 'admin', overrides = {}) {
    const userId = overrides.user_id || uuidv4();
    const tenantId = overrides.tenant_id || MOCK_TENANT_ID;
    const email = overrides.email || `test-${userId.slice(0, 8)}@example.com`;
    
    const result = await this.query(
      `INSERT INTO user_accounts (
        user_id, tenant_id, auth0_user_id, email, name, role, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        userId,
        tenantId,
        overrides.auth0_user_id || `auth0|${userId.slice(0, 8)}`,
        email,
        overrides.name || `Test ${role.charAt(0).toUpperCase() + role.slice(1)}`,
        role,
        overrides.status || 'active'
      ]
    );
    
    return result.rows[0];
  }
  
  /**
   * Create a test employee with optional custom properties
   * @param {Object} overrides - Properties to override
   * @returns {Promise<Object>} - Created employee record
   */
  async createTestEmployee(overrides = {}) {
    const employeeId = overrides.employee_id || uuidv4();
    const tenantId = overrides.tenant_id || MOCK_TENANT_ID;
    const email = overrides.email || `employee-${employeeId.slice(0, 8)}@example.com`;
    
    const result = await this.query(
      `INSERT INTO employees (
        employee_id, tenant_id, email, first_name, last_name, status
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        employeeId,
        tenantId,
        email,
        overrides.first_name || 'Test',
        overrides.last_name || 'Employee',
        overrides.status || 'active'
      ]
    );
    
    return result.rows[0];
  }
  
  /**
   * Create a test equity pool with optional custom properties
   * @param {Object} overrides - Properties to override
   * @returns {Promise<Object>} - Created pool record
   */
  async createTestEquityPool(overrides = {}) {
    const poolId = overrides.pool_id || uuidv4();
    const tenantId = overrides.tenant_id || MOCK_TENANT_ID;
    const initialAmount = overrides.initial_amount || '1000.000';
    const createdBy = overrides.created_by || (await this.getOrCreateAdminUser()).user_id;
    
    const result = await this.query(
      `INSERT INTO equity_pools (
        pool_id, tenant_id, initial_amount, total_pool, created_by
      ) VALUES ($1, $2, $3, $3, $4)
      RETURNING *`,
      [poolId, tenantId, initialAmount, createdBy]
    );
    
    return result.rows[0];
  }
  
  /**
   * Get an existing admin user or create one if none exists
   * @returns {Promise<Object>} - Admin user record
   */
  async getOrCreateAdminUser() {
    let result = await this.query(
      `SELECT * FROM user_accounts 
       WHERE tenant_id = $1 AND role = 'admin' AND deleted_at IS NULL
       LIMIT 1`,
      [MOCK_TENANT_ID]
    );
    
    if (result.rows.length === 0) {
      result = await this.query(
        `INSERT INTO user_accounts (
          user_id, tenant_id, auth0_user_id, email, name, role, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          uuidv4(),
          MOCK_TENANT_ID,
          'auth0|admin',
          'admin@test.com',
          'Test Admin',
          'admin',
          'active'
        ]
      );
    }
    
    return result.rows[0];
  }
}

module.exports = DbTestHelper;
