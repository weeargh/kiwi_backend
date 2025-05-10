const express = require('express');
const { pool } = require('../config/db');
const logger = require('../config/logger');
const { authorizeRole } = require('../middleware/auth');
const { logAuditAction } = require('../utils/auditLogger');

const router = express.Router();

// Apply admin authorization to all routes in this file
router.use(authorizeRole('admin'));

// POST /api/users
// Creates a user record within the application (Admin only).
// The user will be linked to Auth0 on their first login.
router.post('/', async (req, res, next) => {
  const { email, name, role } = req.body;
  const tenantId = req.user?.tenantId;
  const adminUserId = req.user?.id; // User performing the action

  if (!email || !name || !role) {
    return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Missing required fields: email, name, role.' } });
  }

  // Validate role
  if (!['admin', 'employee'].includes(role)) {
    return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid role specified.' } });
  }

  try {
    // Check if email already exists for this tenant (and is not deleted)
    const emailCheck = await pool.query(
      'SELECT 1 FROM user_accounts WHERE email = $1 AND tenant_id = $2 AND deleted_at IS NULL',
      [email, tenantId]
    );
    if (emailCheck.rows.length > 0) {
      return res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'User with this email already exists in this tenant.' } });
    }

    // Insert new user (status defaults to 'active')
    // Note: auth0_user_id will be null initially, populated by syncUser on first login.
    const result = await pool.query(
      'INSERT INTO user_accounts (tenant_id, email, name, role) VALUES ($1, $2, $3, $4) RETURNING user_id, tenant_id, auth0_user_id, email, name, role, status, created_at, deleted_at',
      [tenantId, email, name, role]
    );

    const newUser = result.rows[0];
    logger.info(`Admin ${adminUserId} created user ${newUser.user_id} with email ${email} in tenant ${tenantId}`);
    
    logAuditAction({
      tenantId,
      userId: adminUserId,
      actionType: 'USER_CREATE',
      entityType: 'user',
      entityId: newUser.user_id,
      details: { createdUser: newUser } 
    });

    res.status(201).json({ success: true, data: newUser });
  } catch (error) {
    logger.error(`Error creating user with email ${email} in tenant ${tenantId}: ${error.message}`, { stack: error.stack });
    // Handle potential unique constraint violations if logic changes
    if (error.code === '23505') { // unique_violation
        return res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'User creation conflict (potential race condition or duplicate).' } });
    }
    next(error);
  }
});

// GET /api/users
// Lists users for the current tenant (Admin only) with pagination.
router.get('/', async (req, res, next) => {
  const tenantId = req.user?.tenantId;
  const { page = 1, limit = 20, status } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const adminUserId = req.user?.id;

  // Input validation for pagination
  if (isNaN(parseInt(page)) || parseInt(page) < 1 || isNaN(parseInt(limit)) || parseInt(limit) < 1 || parseInt(limit) > 100) {
    return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid pagination parameters.' } });
  }

  // Build query dynamically based on status filter
  const queryParams = [tenantId, parseInt(limit), offset];
  let baseQuery = 'FROM user_accounts WHERE tenant_id = $1 AND deleted_at IS NULL';
  let countQuery = 'SELECT COUNT(*) AS total_items ';
  let selectQuery = 'SELECT user_id, tenant_id, auth0_user_id, email, name, role, status, created_at, deleted_at ';

  if (status) {
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid status filter.' } });
    }
    baseQuery += ` AND status = $${queryParams.length + 1}`;
    queryParams.push(status);
  }

  countQuery += baseQuery;
  selectQuery += baseQuery + ` ORDER BY created_at DESC LIMIT $2 OFFSET $3`;

  try {
    // Execute count and select queries concurrently
    const [countResult, usersResult] = await Promise.all([
      pool.query(countQuery, queryParams.slice(0, 1).concat(queryParams.slice(3))), // Only tenantId and status for count
      pool.query(selectQuery, queryParams)
    ]);

    const totalItems = parseInt(countResult.rows[0].total_items);
    const totalPages = Math.ceil(totalItems / parseInt(limit));

    res.json({
      success: true,
      data: {
        items: usersResult.rows,
        pagination: {
          total_items: totalItems,
          total_pages: totalPages,
          current_page: parseInt(page),
          limit: parseInt(limit),
          next_page: parseInt(page) < totalPages ? parseInt(page) + 1 : null,
          prev_page: parseInt(page) > 1 ? parseInt(page) - 1 : null,
        },
      },
    });
  } catch (error) {
    logger.error(`Error listing users for tenant ${tenantId}: ${error.message}`, { stack: error.stack });
    next(error);
  }
});

// GET /api/users/:user_id
// Gets a specific user by ID within the tenant (Admin only).
router.get('/:user_id', async (req, res, next) => {
  const { user_id } = req.params;
  const tenantId = req.user?.tenantId;
  const adminUserId = req.user?.id;

  try {
    const result = await pool.query(
      'SELECT user_id, tenant_id, auth0_user_id, email, name, role, status, created_at, deleted_at FROM user_accounts WHERE user_id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
      [user_id, tenantId]
    );

    if (result.rows.length === 0) {
      logger.warn(`Admin ${adminUserId} failed to find user ${user_id} in tenant ${tenantId}`);
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found in this tenant.' } });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error(`Error fetching user ${user_id} for tenant ${tenantId}: ${error.message}`, { stack: error.stack });
    next(error);
  }
});

// PATCH /api/users/:user_id
// Updates a specific user's details (Admin only).
router.patch('/:user_id', async (req, res, next) => {
  const { user_id } = req.params;
  const tenantId = req.user?.tenantId;
  const adminUserId = req.user?.id;
  const { name, status, role } = req.body;

  // Validate input
  if (name === undefined && status === undefined && role === undefined) {
    return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'No update fields provided (name, status, or role).' } });
  }
  if (status && !['active', 'inactive'].includes(status)) {
    return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid status specified.' } });
  }
  if (role && !['admin', 'employee'].includes(role)) {
    return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid role specified.' } });
  }

  // Build dynamic query
  const fieldsToUpdate = [];
  const values = [];
  let queryParamIndex = 1;

  if (name !== undefined) {
    fieldsToUpdate.push(`name = $${queryParamIndex++}`);
    values.push(name);
  }
  if (status !== undefined) {
    fieldsToUpdate.push(`status = $${queryParamIndex++}`);
    values.push(status);
  }
  if (role !== undefined) {
    fieldsToUpdate.push(`role = $${queryParamIndex++}`);
    values.push(role);
  }

  values.push(user_id); // For WHERE user_id
  values.push(tenantId); // For WHERE tenant_id

  const updateQuery = `
    UPDATE user_accounts
    SET ${fieldsToUpdate.join(', ')}
    WHERE user_id = $${queryParamIndex++} AND tenant_id = $${queryParamIndex} AND deleted_at IS NULL
    RETURNING user_id, tenant_id, auth0_user_id, email, name, role, status, created_at, deleted_at
  `;

  try {
    const result = await pool.query(updateQuery, values);

    if (result.rows.length === 0) {
      logger.warn(`Admin ${adminUserId} failed to update non-existent/deleted user ${user_id} in tenant ${tenantId}`);
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found or already deleted.' } });
    }

    const updatedUser = result.rows[0];
    logger.info(`Admin ${adminUserId} updated user ${user_id} in tenant ${tenantId}. Changes: ${JSON.stringify(req.body)}`);
    
    logAuditAction({
      tenantId,
      userId: adminUserId,
      actionType: 'USER_UPDATE',
      entityType: 'user',
      entityId: user_id,
      details: { updatedFields: req.body, userAfterUpdate: updatedUser }
    });

    res.json({ success: true, data: updatedUser });
  } catch (error) {
    logger.error(`Error updating user ${user_id} in tenant ${tenantId}: ${error.message}`, { stack: error.stack });
    next(error);
  }
});

// DELETE /api/users/:user_id
// Soft deletes a user (Admin only).
router.delete('/:user_id', async (req, res, next) => {
  const { user_id } = req.params;
  const tenantId = req.user?.tenantId;
  const adminUserId = req.user?.id;

  try {
    const result = await pool.query(
      'UPDATE user_accounts SET deleted_at = current_timestamp WHERE user_id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING user_id',
      [user_id, tenantId]
    );

    if (result.rowCount === 0) {
      // Either user doesn't exist or was already deleted
      logger.warn(`Admin ${adminUserId} failed to delete user ${user_id} in tenant ${tenantId} (not found or already deleted).`);
      // Consider returning 404, but 200 is also acceptable for idempotency if already deleted
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found or already deleted.' } });
    }

    logger.info(`Admin ${adminUserId} soft deleted user ${user_id} in tenant ${tenantId}`);
    
    logAuditAction({
      tenantId,
      userId: adminUserId,
      actionType: 'USER_DELETE',
      entityType: 'user',
      entityId: user_id,
      details: { deletedUserId: user_id }
    });

    res.status(200).json({ success: true, data: { message: 'User successfully deleted.' } }); // Send success message as per api.yml Success schema

  } catch (error) {
    logger.error(`Error deleting user ${user_id} in tenant ${tenantId}: ${error.message}`, { stack: error.stack });
    next(error);
  }
});

module.exports = router; 