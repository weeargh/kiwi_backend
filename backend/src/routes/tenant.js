const express = require('express');
const { pool } = require('../config/db'); // Import pool from dedicated db.js
const logger = require('../config/logger');
const { authorizeRole } = require('../middleware/auth'); // Import role authorization
const { logAuditAction } = require('../utils/auditLogger'); // Import audit logger

const router = express.Router();

// GET /api/tenant
// Retrieves the tenant details associated with the authenticated user.
// Protected by checkJwt and syncUser middleware applied in index.js
router.get('/', async (req, res, next) => {
  const tenantId = req.user?.tenantId; // Get tenantId from the user object attached by syncUser

  if (!tenantId) {
    // Should not happen if syncUser ran correctly
    logger.error('Tenant ID missing in req.user after authentication middleware.');
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Tenant information missing.' } });
  }

  try {
    const result = await pool.query(
      'SELECT tenant_id, name, currency, timezone, created_at FROM tenants WHERE tenant_id = $1 AND deleted_at IS NULL',
      [tenantId]
    );

    if (result.rows.length === 0) {
      logger.warn(`Tenant not found for ID: ${tenantId}`);
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found.' } });
    }

    logger.info(`Tenant found, sending data for tenant ID: ${tenantId}`, { data: result.rows[0] });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error(`Error fetching tenant ${tenantId}: ${error.message}`, { stack: error.stack });
    next(error); // Pass error to the central error handler
  }
});

// PATCH /api/tenant
// Updates the current tenant's details (e.g., name, timezone).
// Requires Admin role.
// Protected by checkJwt and syncUser middleware applied in index.js, plus authorizeRole('admin') here.
router.patch('/', authorizeRole('admin'), async (req, res, next) => {
  const tenantId = req.user?.tenantId;
  const { name, timezone } = req.body;
  const adminUserId = req.user?.id; // User performing the action

  if (!tenantId) {
    logger.error('Tenant ID missing in req.user during tenant update attempt.');
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Tenant information missing.' } });
  }

  // Basic validation: Ensure at least one field is being updated
  if (name === undefined && timezone === undefined) {
    return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'No update fields provided (name or timezone).' } });
  }

  // Validate timezone if provided
  if (timezone !== undefined) {
    // Basic IANA timezone format validation (e.g., Area/Location or Area/Location/SubLocation)
    // This is a basic check and doesn't ensure it's a *valid* IANA zone, only that the format is plausible.
    const ianaRegex = /^[A-Za-z_]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?$/;
    if (typeof timezone !== 'string' || !ianaRegex.test(timezone)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid timezone format. Expected IANA format (e.g., America/New_York).'
        }
      });
    }
  }

  // Build the update query dynamically
  const fieldsToUpdate = [];
  const values = [];
  let queryParamIndex = 1;

  if (name !== undefined) {
    fieldsToUpdate.push(`name = $${queryParamIndex++}`);
    values.push(name);
  }
  if (timezone !== undefined) {
    // TODO: Add timezone validation if needed (e.g., against a list of valid IANA IDs)
    fieldsToUpdate.push(`timezone = $${queryParamIndex++}`);
    values.push(timezone);
  }

  values.push(tenantId); // Add tenantId for the WHERE clause

  const updateQuery = `
    UPDATE tenants
    SET ${fieldsToUpdate.join(', ')}
    WHERE tenant_id = $${queryParamIndex} AND deleted_at IS NULL
    RETURNING tenant_id, name, currency, timezone, created_at
  `;

  try {
    const result = await pool.query(updateQuery, values);

    if (result.rows.length === 0) {
      logger.warn(`Attempted to update non-existent or deleted tenant: ${tenantId}`);
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found or already deleted.' } });
    }

    const updatedTenant = result.rows[0];
    logger.info(`Tenant ${tenantId} updated successfully by user ${adminUserId}`);
    
    // Audit log entry
    logAuditAction({
      tenantId,
      userId: adminUserId,
      actionType: 'TENANT_UPDATE',
      entityType: 'tenant',
      entityId: tenantId,
      details: { updatedFields: req.body, afrer: updatedTenant } // Log requested changes and actual result
    });

    res.json({ success: true, data: updatedTenant });

  } catch (error) {
    // Handle potential errors like invalid timezone format if DB constraints exist
    logger.error(`Error updating tenant ${tenantId}: ${error.message}`, { stack: error.stack });
    next(error);
  }
});


module.exports = router; 