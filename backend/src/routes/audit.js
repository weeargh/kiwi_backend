const express = require('express');
const { pool } = require('../config/db');
const logger = require('../config/logger');
const { authorizeRole } = require('../middleware/auth');
const { logAuditAction } = require('../utils/auditLogger');

const router = express.Router();

// Ensure all routes require authentication
router.use(authorizeRole(['admin', 'employee']));

/**
 * GET /api/audit-logs
 * Retrieves audit logs with pagination
 */
router.get('/', async (req, res, next) => {
  const tenantId = req.user?.tenantId;
  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  logger.info(`GET /api/audit-logs for tenant ${tenantId}`);

  try {
    // Query for audit logs with pagination
    const logsQuery = `
      SELECT 
        log_id, tenant_id, action_type, entity_type, entity_id, 
        details, created_by, created_at
      FROM 
        audit_logs
      WHERE 
        tenant_id = $1
        AND deleted_at IS NULL
      ORDER BY 
        created_at DESC
      LIMIT $2::integer OFFSET $3::integer
    `;

    const countQuery = `
      SELECT COUNT(*) AS total_items
      FROM audit_logs
      WHERE 
        tenant_id = $1
        AND deleted_at IS NULL
    `;

    // Execute both queries concurrently
    const [logsResult, countResult] = await Promise.all([
      pool.query(logsQuery, [tenantId, parseInt(limit), offset]),
      pool.query(countQuery, [tenantId])
    ]);

    const totalItems = parseInt(countResult.rows[0].total_items);
    const totalPages = Math.ceil(totalItems / parseInt(limit));

    res.json({
      success: true,
      data: {
        items: logsResult.rows,
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
    logger.error(`Error retrieving audit logs for tenant ${tenantId}: ${error.message}`, { stack: error.stack });
    next(error);
  }
});

module.exports = router;
