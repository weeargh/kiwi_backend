const express = require('express');
const { pool } = require('../config/db');
const logger = require('../config/logger');
const { authorizeRole } = require('../middleware/auth');
const { logAuditAction } = require('../utils/auditLogger');

const router = express.Router();

// Ensure all routes require authentication
router.use(authorizeRole(['admin', 'employee']));

/**
 * GET /api/pps/current
 * Retrieves the currently effective price per share for the tenant
 */
router.get('/current', async (req, res, next) => {
  const tenantId = req.user?.tenantId;
  logger.info(`GET /api/pps/current for tenant ${tenantId}`);

  try {
    // Find the most recent PPS for the current date using the special lookup query
    // This retrieves the PPS with the most recent effective date that's <= today,
    // and if multiple entries have the same date, it takes the one with the latest created_at
    const result = await pool.query(`
      SELECT 
        pps_id, tenant_id, effective_date, price_per_share, created_by, created_at
      FROM 
        pps_history
      WHERE 
        tenant_id = $1
        AND effective_date <= CURRENT_DATE
        AND deleted_at IS NULL
      ORDER BY 
        effective_date DESC, created_at DESC
      LIMIT 1
    `, [tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'No price per share has been set for this tenant.'
        }
      });
    }

    // Format price_per_share as string with 3 decimal places
    const pps = result.rows[0];
    pps.price_per_share = parseFloat(pps.price_per_share).toFixed(3);

    res.json({
      success: true,
      data: pps
    });
  } catch (error) {
    logger.error(`Error retrieving current PPS for tenant ${tenantId}: ${error.message}`, { stack: error.stack });
    next(error);
  }
});

/**
 * GET /api/pps
 * Lists all PPS history entries with pagination
 */
router.get('/', async (req, res, next) => {
  const tenantId = req.user?.tenantId;
  const { page = 1, limit = 20, from_date, to_date } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  logger.info(`GET /api/pps for tenant ${tenantId}`);

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
    // Build dynamic query for date filtering
    let queryParams = [tenantId, parseInt(limit), offset];
    let dateFilterClause = '';
    let paramIndex = 4;

    if (from_date) {
      dateFilterClause += ` AND effective_date >= $${paramIndex++}::date`;
      queryParams.push(from_date);
    }

    if (to_date) {
      dateFilterClause += ` AND effective_date <= $${paramIndex++}::date`;
      queryParams.push(to_date);
    }

    // Query for PPS history with pagination
    const ppsQuery = `
      SELECT 
        pps_id, tenant_id, effective_date, price_per_share, created_by, created_at
      FROM 
        pps_history
      WHERE 
        tenant_id = $1
        AND deleted_at IS NULL
        ${dateFilterClause}
      ORDER BY 
        effective_date DESC, created_at DESC
      LIMIT $2::integer OFFSET $3::integer
    `;

    // Query for total count
    const countQuery = `
      SELECT COUNT(*) AS total_items
      FROM pps_history
      WHERE 
        tenant_id = $1
        AND deleted_at IS NULL
        ${dateFilterClause.replace(/\$\d+/g, (match, offset, string) => {
          // Replace $4::date with $2::date and $5::date with $3::date for the count query
          const paramNumber = parseInt(match.substring(1));
          return `$${paramNumber - 2}::date`;
        })}
    `;

    // Prepare parameters for count query
    const countParams = [tenantId];
    if (from_date) {
      countParams.push(from_date);
    }
    if (to_date) {
      countParams.push(to_date);
    }

    // Execute both queries concurrently
    const [ppsResult, countResult] = await Promise.all([
      pool.query(ppsQuery, queryParams),
      pool.query(countQuery, countParams)
    ]);

    // Format decimal values as strings with 3 decimal places
    const historyItems = ppsResult.rows.map(item => ({
      ...item,
      price_per_share: parseFloat(item.price_per_share).toFixed(3)
    }));

    const totalItems = parseInt(countResult.rows[0].total_items);
    const totalPages = Math.ceil(totalItems / parseInt(limit));

    res.json({
      success: true,
      data: {
        items: historyItems,
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
    logger.error(`Error retrieving PPS history for tenant ${tenantId}: ${error.message}`, { stack: error.stack });
    next(error);
  }
});

/**
 * POST /api/pps
 * Creates a new price per share entry
 * Requires admin role
 */
router.post('/', authorizeRole('admin'), async (req, res, next) => {
  const tenantId = req.user?.tenantId;
  const adminUserId = req.user?.id;
  const { effective_date, price_per_share } = req.body;

  logger.info(`POST /api/pps for tenant ${tenantId}`);

  // Input validation
  if (!effective_date || !price_per_share) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Missing required fields: effective_date, price_per_share'
      }
    });
  }

  // Validate price_per_share
  const ppsValue = parseFloat(price_per_share);
  if (isNaN(ppsValue) || ppsValue <= 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Price per share must be a positive number'
      }
    });
  }

  try {
    // Begin transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Insert the new PPS record
      const ppsResult = await client.query(`
        INSERT INTO pps_history(
          tenant_id, effective_date, price_per_share, created_by
        ) VALUES ($1, $2, $3, $4)
        RETURNING pps_id, tenant_id, effective_date, price_per_share, created_by, created_at
      `, [tenantId, effective_date, ppsValue, adminUserId]);

      const newPps = ppsResult.rows[0];

      // Format decimal fields
      newPps.price_per_share = parseFloat(newPps.price_per_share).toFixed(3);

      // TODO: When VestingEvent table exists, update pps_snapshot for affected vesting events
      // This would be implemented in Stage 4 when the vesting engine is created

      await client.query('COMMIT');

      logger.info(`PPS entry created successfully for tenant ${tenantId} by admin ${adminUserId}`);
      
      logAuditAction({
        tenantId,
        userId: adminUserId,
        actionType: 'PPS_CREATE',
        entityType: 'pps_history',
        entityId: newPps.pps_id,
        details: { request: req.body, createdPps: newPps },
        dbClient: client // Pass the client to ensure audit log is part of the same transaction
      });

      res.status(201).json({
        success: true,
        data: newPps
      });
    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error(`Error creating PPS entry for tenant ${tenantId}: ${error.message}`, { stack: error.stack });
    next(error);
  }
});

module.exports = router; 