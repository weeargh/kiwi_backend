const express = require('express');
const router = express.Router();
const knex = require('../config/db');
const { checkJwt, syncUser, checkRoleAdmin } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');

// TODO: Input validation middleware

// POST /grants - Create a new grant
router.post('/', checkJwt, syncUser, checkRoleAdmin, async (req, res) => {
  const { employee_id, grant_date, share_amount } = req.body;
  const { tenant_id, user_id: created_by } = req.auth.payload;

  if (!employee_id || !grant_date || !share_amount) {
    return res.status(400).json({ success: false, error: { message: 'Employee ID, grant date, and share amount are required.' } });
  }
  if (isNaN(parseFloat(share_amount)) || parseFloat(share_amount) <= 0) {
    return res.status(400).json({ success: false, error: { message: 'Share amount must be a positive number.' } });
  }

  try {
    // Ensure employee exists and belongs to the tenant
    const employee = await knex('employees')
      .where({ employee_id, tenant_id, deleted_at: null, status: 'active' })
      .first();
    if (!employee) {
      return res.status(404).json({ success: false, error: { message: 'Active employee not found for this tenant.' } });
    }
    
    // Use sp_adjust_pool for grant creation (which should check available shares)
    // This stored procedure needs to be updated/created to handle grant deductions.
    // For now, assuming it exists and works. The spec says:
    // "POST /grants uses sp_adjust_pool (updated to handle grant creation) with SERIALIZABLE isolation and validates share_amount <= Available."

    let newGrant;
    await knex.transaction(async (trx) => {
      // Placeholder for sp_adjust_pool logic or direct check
      // Fetch current pool state
      const pool = await trx('equity_pools').where({ tenant_id }).first();
      if (!pool) {
        throw new Error('Equity pool not found for this tenant.');
      }
      const availableShares = parseFloat(pool.total_pool) - parseFloat(pool.granted_shares || 0) + parseFloat(pool.returned_shares || 0);
      
      if (parseFloat(share_amount) > availableShares) {
        throw new Error(`Not enough available shares in the pool. Available: ${availableShares}, Requested: ${share_amount}`);
      }

      const grant_id = uuidv4();
      newGrant = {
        grant_id,
        tenant_id,
        employee_id,
        grant_date,
        share_amount: parseFloat(share_amount).toFixed(3),
        vested_amount: '0.000', // Default
        status: 'active',       // Default
        version: 0,             // Default
        created_by,
        created_at: new Date().toISOString(),
        unvested_shares_returned: '0.000' // Default
      };

      await trx('grants').insert(newGrant);

      // Update pool's granted_shares (simplified, actual logic should be in sp_adjust_pool)
      // This is a conceptual update; sp_adjust_pool should handle this atomically.
      // For now, we'll assume sp_adjust_pool is called or its logic is replicated.
      // If sp_adjust_pool is not yet updated for grants, this direct update is risky.
      // For the purpose of this step, we'll simulate the effect.
      await trx('equity_pools')
        .where({ pool_id: pool.pool_id })
        .increment('granted_shares', parseFloat(share_amount));

      // TODO: Add audit log entry
    });
    
    logger.info(`Grant created: ${newGrant.grant_id} for employee ${employee_id} by user ${created_by}`);
    res.status(201).json({ success: true, data: newGrant });

  } catch (error) {
    logger.error('Error creating grant:', { error: error.message, stack: error.stack });
    res.status(error.message.startsWith('Not enough available shares') ? 400 : 500)
       .json({ success: false, error: { message: error.message || 'Failed to create grant.' } });
  }
});

// GET /grants - List grants
router.get('/', checkJwt, syncUser, async (req, res) => {
  const { tenant_id, user_id, roles } = req.auth.payload;
  const { page = 1, limit = 20, status, employee_id: query_employee_id } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let query = knex('grants').where({ 'grants.tenant_id': tenant_id, 'grants.deleted_at': null });

    // If user is not admin, they can only see their own grants (linked via user_id -> employee_id)
    // This requires a link between user_accounts.user_id and employees.employee_id,
    // or user_accounts.email to employees.email.
    // Assuming user_accounts.email maps to employees.email for non-admins.
    if (!roles.includes('admin')) {
      const currentUserEmployee = await knex('employees')
        .where({ tenant_id, email: req.auth.payload.email, deleted_at: null, status: 'active' })
        .first();
      if (!currentUserEmployee) {
        return res.json({ success: true, data: { items: [], pagination: { total_items: 0, total_pages: 0, current_page: 1, limit: parseInt(limit) } } });
      }
      query = query.andWhere({ 'grants.employee_id': currentUserEmployee.employee_id });
    } else if (query_employee_id) { // Admin can filter by employee_id
      query = query.andWhere({ 'grants.employee_id': query_employee_id });
    }

    if (status) {
      query = query.andWhere({ 'grants.status': status });
    }
    
    // Join with employees table to get employee names
    query = query.join('employees', 'grants.employee_id', '=', 'employees.employee_id')
                 .select('grants.*', 'employees.first_name', 'employees.last_name', 'employees.email as employee_email');


    const totalGrants = await query.clone().count({ count: 'grants.grant_id' }).first();
    const grantsData = await query.limit(parseInt(limit)).offset(offset).orderBy('grants.grant_date', 'desc');
    
    res.json({
      success: true,
      data: {
        items: grantsData,
        pagination: {
          total_items: parseInt(totalGrants.count),
          total_pages: Math.ceil(totalGrants.count / limit),
          current_page: parseInt(page),
          limit: parseInt(limit),
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching grants:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch grants.', details: error.message } });
  }
});

// GET /grants/:grant_id - Get grant details
router.get('/:grant_id', checkJwt, syncUser, async (req, res) => {
  const { tenant_id, user_id, roles } = req.auth.payload;
  const { grant_id } = req.params;

  try {
    const grant = await knex('grants')
      .join('employees', 'grants.employee_id', '=', 'employees.employee_id')
      .where({ 'grants.tenant_id': tenant_id, 'grants.grant_id': grant_id, 'grants.deleted_at': null })
      .select('grants.*', 'employees.first_name', 'employees.last_name', 'employees.email as employee_email')
      .first();

    if (!grant) {
      return res.status(404).json({ success: false, error: { message: 'Grant not found.' } });
    }

    // If user is not admin, check if they own the grant
    if (!roles.includes('admin')) {
      const currentUserEmployee = await knex('employees')
        .where({ tenant_id, email: req.auth.payload.email, deleted_at: null, status: 'active' })
        .first();
      if (!currentUserEmployee || grant.employee_id !== currentUserEmployee.employee_id) {
        return res.status(403).json({ success: false, error: { message: 'Forbidden: You do not have access to this grant.' } });
      }
    }
    
    // TODO: Fetch vesting_events if needed for detailed view, or rely on /grants/:grant_id/vesting-events
    res.json({ success: true, data: grant });
  } catch (error) {
    logger.error(`Error fetching grant ${grant_id}:`, error);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch grant.', details: error.message } });
  }
});


// TODO: PATCH /grants/:grant_id - Update grant (limited fields, versioning)
// TODO: DELETE /grants/:grant_id - Soft delete grant
// TODO: POST /grants/bulk - Bulk create grants

module.exports = router;
