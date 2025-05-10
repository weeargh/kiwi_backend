const { pool } = require('../config/db');
const logger = require('../config/logger');

/**
 * Logs an action to the audit_logs table.
 *
 * @param {object} options - The audit log options.
 * @param {string} options.tenantId - The ID of the tenant.
 * @param {string} [options.userId] - The ID of the user performing the action (can be null for system actions).
 * @param {string} options.actionType - The type of action performed (e.g., 'USER_CREATE', 'TENANT_UPDATE').
 * @param {string} [options.entityType] - The type of entity being affected (e.g., 'user', 'tenant', 'pool_event').
 * @param {string} [options.entityId] - The ID of the entity being affected.
 * @param {object} [options.details] - An object containing details about the action (e.g., { before: {...}, after: {...} } or request payload).
 * @param {object} [options.dbClient] - Optional database client if called within an existing transaction.
 */
async function logAuditAction(options) {
  const { 
    tenantId, 
    userId, 
    actionType, 
    entityType, 
    entityId, 
    details = {}, // Default to empty object for details
    dbClient // Optional existing DB client
  } = options;

  if (!tenantId || !actionType) {
    logger.error('[AuditLogger] Missing required fields for audit logging: tenantId and actionType must be provided.', options);
    // Decide if to throw an error or just log and continue if audit logging is non-critical path
    return;
  }

  const query = `
    INSERT INTO audit_logs (tenant_id, user_id, action_type, entity_type, entity_id, details)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING log_id;
  `;
  const params = [tenantId, userId, actionType, entityType, entityId, details];

  try {
    const client = dbClient || pool; // Use provided client or get one from the pool
    const result = await client.query(query, params);
    // logger.info(`[AuditLogger] Action logged successfully. Log ID: ${result.rows[0].log_id}`, { actionType, entityId });
  } catch (error) {
    logger.error('[AuditLogger] Failed to write audit log.', 
      { 
        errorMessage: error.message, 
        stack: error.stack, 
        actionType, 
        entityId, 
        tenantId 
      }
    );
    // Depending on policy, this error might need to be handled more strictly,
    // but for now, we log it and don't let it break the main operation.
  }
}

module.exports = { logAuditAction }; 