/**
 * Test-only routes that enable E2E testing
 * These routes are only available in test environments for E2E testing support
 * NOT for use in production
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const logger = require('../config/logger');

// Only enable these routes in test environments
if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'e2e') {
  logger.info('Test routes enabled for testing environment');

  /**
   * Reset test database to initial state
   * Clears all data and reseeds with baseline test data
   * POST /api/test/reset-db
   */
  router.post('/reset-db', async (req, res) => {
    try {
      // Get a client with transaction support
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        
        // Disable foreign key checks
        await client.query('SET session_replication_role = replica;');
        
        // Truncate all tables to reset data
        const tables = [
          'vesting_events',
          'grants',
          'employees',
          'pool_events',
          'pps_history',
          'equity_pools',
          'user_accounts',
          'tenants'
        ];
        
        for (const table of tables) {
          await client.query(`TRUNCATE TABLE ${table} CASCADE`);
        }
        
        // Re-enable foreign key checks
        await client.query('SET session_replication_role = DEFAULT;');
        
        // Create default test tenant
        const tenantId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
        await client.query(
          `INSERT INTO tenants (tenant_id, name, currency, timezone)
           VALUES ($1, 'Test Company', 'USD', 'America/New_York')`,
          [tenantId]
        );
        
        // Create default admin user
        const adminId = '11111111-1111-1111-1111-111111111111';
        await client.query(
          `INSERT INTO user_accounts (user_id, tenant_id, auth0_user_id, email, name, role, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            adminId,
            tenantId,
            'auth0|admin-test-123',
            'admin@test.com',
            'Test Admin',
            'admin',
            'active'
          ]
        );
        
        // Create default equity pool
        const poolId = uuidv4();
        const initialAmount = '1000.000';
        await client.query(
          `INSERT INTO equity_pools (pool_id, tenant_id, initial_amount, total_pool, created_by)
           VALUES ($1, $2, $3, $3, $4)`,
          [poolId, tenantId, initialAmount, adminId]
        );
        
        // Create initial pool event
        await client.query(
          `INSERT INTO pool_events (pool_id, tenant_id, event_type, amount, effective_date, notes, created_by)
           VALUES ($1, $2, $3, $4, CURRENT_DATE, $5, $6)`,
          [
            poolId,
            tenantId,
            'initial',
            initialAmount,
            'Initial pool creation',
            adminId
          ]
        );
        
        // Commit transaction
        await client.query('COMMIT');
        
        res.status(200).json({
          success: true,
          message: 'Database reset successfully'
        });
      } catch (error) {
        // Rollback in case of error
        await client.query('ROLLBACK');
        throw error;
      } finally {
        // Release the client
        client.release();
      }
    } catch (error) {
      logger.error(`Error resetting database: ${error.message}`, { stack: error.stack });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error resetting database'
        }
      });
    }
  });

  /**
   * Seed user for E2E testing
   * Creates or updates a user account for testing
   * POST /api/test/seed-user
   */
  router.post('/seed-user', async (req, res) => {
    try {
      const { auth0_id, tenant_id, email, name, role } = req.body;
      
      if (!auth0_id || !tenant_id || !email || !name || !role) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Missing required fields'
          }
        });
      }
      
      // Check if tenant exists
      const tenantResult = await pool.query(
        'SELECT tenant_id FROM tenants WHERE tenant_id = $1',
        [tenant_id]
      );
      
      if (tenantResult.rows.length === 0) {
        // Create tenant if it doesn't exist
        await pool.query(
          `INSERT INTO tenants (tenant_id, name, currency, timezone)
           VALUES ($1, 'Test Company', 'USD', 'America/New_York')`,
          [tenant_id]
        );
      }
      
      // Upsert user account
      await pool.query(
        `INSERT INTO user_accounts (tenant_id, auth0_user_id, email, name, role, status)
         VALUES ($1, $2, $3, $4, $5, 'active')
         ON CONFLICT (tenant_id, email) WHERE deleted_at IS NULL
         DO UPDATE SET auth0_user_id = $2, name = $4, role = $5, status = 'active'`,
        [tenant_id, auth0_id, email, name, role]
      );
      
      res.status(200).json({
        success: true,
        message: 'User seeded successfully'
      });
    } catch (error) {
      logger.error(`Error seeding user: ${error.message}`, { stack: error.stack });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error seeding user'
        }
      });
    }
  });

  /**
   * Seed pool events for testing pagination
   * Creates multiple pool events for testing
   * POST /api/test/seed-pool-events
   */
  router.post('/seed-pool-events', async (req, res) => {
    try {
      const { count = 10, tenant_id } = req.body;
      
      if (!tenant_id) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Missing tenant_id'
          }
        });
      }
      
      // Find the pool for the tenant
      const poolResult = await pool.query(
        'SELECT pool_id FROM equity_pools WHERE tenant_id = $1 LIMIT 1',
        [tenant_id]
      );
      
      if (poolResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'No equity pool found for this tenant'
          }
        });
      }
      
      const poolId = poolResult.rows[0].pool_id;
      
      // Find admin user for the tenant
      const userResult = await pool.query(
        `SELECT user_id FROM user_accounts 
         WHERE tenant_id = $1 AND role = 'admin' AND deleted_at IS NULL 
         LIMIT 1`,
        [tenant_id]
      );
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'No admin user found for this tenant'
          }
        });
      }
      
      const adminId = userResult.rows[0].user_id;
      
      // Create events in a transaction
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        
        // Create pool events
        const events = [];
        for (let i = 0; i < count; i++) {
          const event_type = i % 3 === 0 ? 'top_up' : (i % 3 === 1 ? 'reduction' : 'top_up');
          const amount = i % 3 === 1 ? `-${(i * 10).toFixed(3)}` : `${(i * 10).toFixed(3)}`;
          const daysAgo = count - i;
          
          const result = await client.query(
            `INSERT INTO pool_events (
              pool_id, tenant_id, event_type, amount, effective_date, notes, created_by
             ) VALUES ($1, $2, $3, $4, CURRENT_DATE - $5, $6, $7)
             RETURNING *`,
            [
              poolId,
              tenant_id,
              event_type,
              amount,
              daysAgo,
              `Test event ${i + 1}`,
              adminId
            ]
          );
          
          events.push(result.rows[0]);
        }
        
        // Update the pool's total_pool based on events
        const totalResult = await client.query(
          `SELECT SUM(amount) as total FROM pool_events WHERE pool_id = $1`,
          [poolId]
        );
        
        const totalAmount = totalResult.rows[0].total;
        
        await client.query(
          `UPDATE equity_pools SET total_pool = $1 WHERE pool_id = $2`,
          [totalAmount, poolId]
        );
        
        await client.query('COMMIT');
        
        res.status(200).json({
          success: true,
          message: `${count} pool events created successfully`,
          data: events
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error(`Error seeding pool events: ${error.message}`, { stack: error.stack });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error seeding pool events'
        }
      });
    }
  });
} else {
  // In non-test environments, return 404 for all test routes
  router.all('*', (req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Test routes are only available in test environments'
      }
    });
  });
}

module.exports = router;
