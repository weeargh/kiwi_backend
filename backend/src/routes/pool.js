const express = require('express');
const { pool } = require('../config/db');
const logger = require('../config/logger');
const { authorizeRole } = require('../middleware/auth');
const { logAuditAction } = require('../utils/auditLogger');

const router = express.Router();

// Ensure all routes require authentication
router.use(authorizeRole(['admin', 'employee']));

/**
 * GET /api/pools
 * Retrieves the equity pool for the current tenant with calculated metrics
 */
router.get('/', async (req, res, next) => {
  const tenantId = req.user?.tenantId;
  logger.info(`GET /api/pools for tenant ${tenantId}`);

  try {
    // First, check if the pool exists for this tenant
    const poolResult = await pool.query(
      'SELECT pool_id, tenant_id, initial_amount, total_pool, created_by, created_at FROM equity_pools WHERE tenant_id = $1 AND deleted_at IS NULL',
      [tenantId]
    );

    const equityPool = poolResult.rows.length === 0
      ? await pool.query(
          'INSERT INTO equity_pools (pool_id, tenant_id, initial_amount, total_pool, created_by, created_at) VALUES (gen_random_uuid(), $1, $2, $2, $3, NOW()) RETURNING *',
          [tenantId, '100000.000', req.user.id]
        ).then(result => result.rows[0])
      : poolResult.rows[0];

    // For Stage 2, grants table does not exist, so granted and returned are always 0.
    const grantedShares = 0.000;
    const returnedShares = 0.000;
    
    // Calculate available shares: TotalPool - Granted + Returned
    // equityPool.total_pool is a string from DB (DECIMAL), convert to number for calculation.
    const availableShares = parseFloat(equityPool.total_pool) - grantedShares + returnedShares;

    // Format the response with all metrics
    const response = {
      ...equityPool,
      granted_shares: parseFloat(grantedShares).toFixed(3),
      returned_shares: parseFloat(returnedShares).toFixed(3),
      available_shares: parseFloat(availableShares).toFixed(3),
      // Convert decimal fields to strings with 3 decimal places for consistency
      initial_amount: parseFloat(equityPool.initial_amount).toFixed(3),
      total_pool: parseFloat(equityPool.total_pool).toFixed(3)
    };

    // Enforce strict API response schema as per SPECIFICATION.md and api.yml
    // All fields must be present and types must match (DECIMAL fields as strings with 3 decimal places)
    res.json({
      success: true,
      data: {
        pool_id: String(equityPool.pool_id),
        tenant_id: String(equityPool.tenant_id),
        initial_amount: parseFloat(equityPool.initial_amount).toFixed(3),
        total_pool: parseFloat(equityPool.total_pool).toFixed(3),
        granted_shares: parseFloat(grantedShares).toFixed(3),
        returned_shares: parseFloat(returnedShares).toFixed(3),
        available_shares: parseFloat(availableShares).toFixed(3),
        created_by: String(equityPool.created_by),
        created_at: equityPool.created_at ? new Date(equityPool.created_at).toISOString() : null
      }
    });
  } catch (error) {
    logger.error(`Error retrieving equity pool for tenant ${tenantId}: ${error.message}`, { stack: error.stack });
    // Strict error response schema as per SPECIFICATION.md and api.yml
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve equity pool',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/pools/{pool_id}/events
 * Creates a new pool event (top-up or reduction)
 * Requires admin role
 */
router.post('/:pool_id/events', authorizeRole('admin'), async (req, res, next) => {
  const { pool_id } = req.params;
  const tenantId = req.user?.tenantId;
  const adminUserId = req.user?.id;
  const { amount, event_type, effective_date, notes } = req.body;

  logger.info(`POST /api/pools/${pool_id}/events for tenant ${tenantId}`);

  // Input validation
  if (!amount || !event_type || !effective_date) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Missing required fields: amount, event_type, effective_date'
      }
    });
  }
  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Amount must be a valid decimal number'
      }
    });
  }
  const finalAmount = event_type === 'reduction' ? -Math.abs(parsedAmount) : Math.abs(parsedAmount); // Keep as number
  if (!['top_up', 'reduction'].includes(event_type)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Event type must be either "top_up" or "reduction"'
      }
    });
  }

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');

      const functionCallQuery = `
        SELECT * FROM func_adjust_pool_v3($1::UUID, $2::UUID, $3::VARCHAR, $4::TEXT, $5::DATE, $6::TEXT, $7::UUID)
      `; // Call v3, explicitly cast $4 to TEXT
      const functionCallParams = [
        pool_id,      
        tenantId,     
        event_type,   
        finalAmount.toFixed(3), // Pass as string
        effective_date, 
        notes,        
        adminUserId   
      ];
      
      const result = await client.query(functionCallQuery, functionCallParams);
      
      if (result.rows.length === 0) {
        logger.error('func_adjust_pool_v3 did not return a row for a supposedly successful operation.', 
                     { pool_id, tenantId, event_type, finalAmount });
        throw new Error('Pool event creation via stored function failed to return event details.');
      }
      
      const event = result.rows[0]; 
      // Format for API response consistency, func_adjust_pool_v3 returns DECIMAL which pg driver might give as string or number
      event.amount = parseFloat(event.amount).toFixed(3); 

      await client.query('COMMIT');
      logger.info(`Pool event created successfully for pool ${pool_id} by admin ${adminUserId} via func_adjust_pool_v3`);
      
      // Pass client to audit log if it might do further queries, otherwise not strictly necessary after COMMIT
      // For safety, if logAuditAction might use the client, keep it. Or ensure it gets its own if needed.
      await logAuditAction({ // Added await here
        tenantId,
        userId: adminUserId,
        actionType: 'POOL_EVENT_CREATE',
        entityType: 'pool_event',
        entityId: event.event_id,
        details: { request: req.body, createdEvent: event }, // Consider if event needs all fields formatted
        // dbClient: client // Not passing client after commit, logAuditAction should manage its own connection if needed
      });

      res.status(201).json({
        success: true,
        data: event
      });
    } catch (txError) {
      await client.query('ROLLBACK');
      logger.warn(`Transaction error during pool event creation for pool ${pool_id}. Error: ${txError.message}`, 
                  { code: txError.code, detail: txError.detail, stack: txError.stack });
      if (txError.message.includes('Pool not found with ID:')) {
         return res.status(404).json({ success: false, error: { code: 'POOL_NOT_FOUND', message: txError.message }});
      } else if (txError.message.includes('Cannot reduce pool by') || 
                 txError.message.includes('Pool total cannot be negative') || 
                 txError.message.includes('Invalid amount format') || 
                 txError.message.includes('Amount %s is out of range')) {
        return res.status(400).json({ success: false, error: { code: 'POOL_ADJUSTMENT_VALIDATION_ERROR', message: txError.message }});
      } else if (txError.message.includes('func_adjust_pool_v3 must be called within a SERIALIZABLE transaction')) { // Updated function name
        logger.error('Critical: func_adjust_pool_v3 was called outside a SERIALIZABLE transaction unexpectedly.', { detail: txError.message });
      }
      next(txError);
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error(`Error creating pool event for pool ${pool_id}: ${error.message}`, { stack: error.stack });
    next(error);
  }
});

/**
 * GET /api/pools/{pool_id}/events
 * Lists events for a specific pool with pagination
 */
router.get('/:pool_id/events', async (req, res, next) => {
  const { pool_id } = req.params;
  const tenantId = req.user?.tenantId;
  const { page = 1, limit = 20, from_date, to_date } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  logger.info(`GET /api/pools/${pool_id}/events for tenant ${tenantId}`);

  // Input validation for pagination
  if (isNaN(parseInt(page)) || parseInt(page) < 1 || isNaN(parseInt(limit)) || parseInt(limit) < 1 || parseInt(limit) > 100) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Invalid pagination parameters'
      }
    });
  }

  try {
    // Verify the pool exists and belongs to this tenant
    const poolCheck = await pool.query(
      'SELECT 1 FROM equity_pools WHERE pool_id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
      [pool_id, tenantId]
    );

    if (poolCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Equity pool not found or does not belong to this tenant'
        }
      });
    }

    // Build dynamic query for date filtering
    let queryParams = [pool_id, tenantId, parseInt(limit), offset];
    let dateFilterClause = '';
    let paramIndex = 5;

    if (from_date) {
      dateFilterClause += ` AND effective_date >= $${paramIndex++}::date`;
      queryParams.push(from_date);
    }

    if (to_date) {
      dateFilterClause += ` AND effective_date <= $${paramIndex++}::date`;
      queryParams.push(to_date);
    }

    // Query for the events with pagination
    const eventsQuery = `
      SELECT 
        event_id, pool_id, tenant_id, amount, event_type, 
        effective_date, notes, created_by, created_at
      FROM pool_events 
      WHERE pool_id = $1 AND tenant_id = $2${dateFilterClause}
      ORDER BY effective_date DESC, created_at DESC
      LIMIT $3::integer OFFSET $4::integer
    `;

    // Query for total count
    const countQuery = `
      SELECT COUNT(*) AS total_items
      FROM pool_events 
      WHERE pool_id = $1 AND tenant_id = $2${dateFilterClause.replace(/\$\d+/g, (match, offset, string) => {
        // Replace $5::date with $3::date and $6::date with $4::date for the count query
        const paramNumber = parseInt(match.substring(1));
        return `$${paramNumber - 2}::date`;
      })}
    `;

    // Prepare parameters for count query
    const countParams = [pool_id, tenantId];
    if (from_date) {
      countParams.push(from_date);
    }
    if (to_date) {
      countParams.push(to_date);
    }

    // Execute both queries concurrently
    const [eventsResult, countResult] = await Promise.all([
      pool.query(eventsQuery, queryParams),
      pool.query(countQuery, countParams)
    ]);

    const events = eventsResult.rows.map(event => ({
      ...event,
      amount: parseFloat(event.amount).toFixed(3) // Format decimal as string with 3 decimal places
    }));

    const totalItems = parseInt(countResult.rows[0].total_items);
    const totalPages = Math.ceil(totalItems / parseInt(limit));

    res.json({
      success: true,
      data: {
        items: events,
        pagination: {
          total_items: totalItems,
          total_pages: totalPages,
          current_page: parseInt(page),
          limit: parseInt(limit),
          next_page: parseInt(page) < totalPages ? parseInt(page) + 1 : null,
          prev_page: parseInt(page) > 1 ? parseInt(page) - 1 : null,
        }
      }
    });
  } catch (error) {
    logger.error(`Error retrieving pool events for pool ${pool_id}: ${error.message}`, { stack: error.stack });
    next(error);
  }
});

module.exports = router; 