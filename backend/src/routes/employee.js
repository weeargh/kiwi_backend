const express = require('express');
const router = express.Router();
const knex = require('../config/db'); // Assuming db.js exports knex instance
const { checkJwt, syncUser, checkRoleAdmin } = require('../middleware/auth'); // Assuming auth middleware
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');

// TODO: Add input validation middleware (e.g., express-validator)

// POST /employees - Create a new employee
router.post('/', checkJwt, syncUser, checkRoleAdmin, async (req, res) => {
  const { email, first_name, last_name } = req.body;
  const { tenant_id, user_id: created_by } = req.auth.payload; // tenant_id and user_id from JWT

  if (!email || !first_name || !last_name) {
    return res.status(400).json({ success: false, error: { message: 'Email, first name, and last name are required.' } });
  }

  try {
    // Check if employee with this email already exists for the tenant (and not soft-deleted)
    const existingEmployee = await knex('employees')
      .where({ tenant_id, email, deleted_at: null })
      .first();

    if (existingEmployee) {
      return res.status(409).json({ success: false, error: { message: 'Employee with this email already exists.' } });
    }

    const employee_id = uuidv4();
    const newEmployee = {
      employee_id,
      tenant_id,
      email,
      first_name,
      last_name,
      status: 'active', // Default status
      created_by,
      created_at: new Date().toISOString(),
    };

    await knex('employees').insert(newEmployee);
    logger.info(`Employee created: ${employee_id} by user ${created_by} for tenant ${tenant_id}`);
    // TODO: Add audit log entry
    res.status(201).json({ success: true, data: newEmployee });
  } catch (error) {
    logger.error('Error creating employee:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to create employee.', details: error.message } });
  }
});

// GET /employees - List employees
router.get('/', checkJwt, syncUser, checkRoleAdmin, async (req, res) => {
  const { tenant_id } = req.auth.payload;
  const { page = 1, limit = 20, status } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let query = knex('employees')
      .where({ tenant_id, deleted_at: null });

    if (status) {
      query = query.andWhere({ status });
    }

    const totalEmployees = await query.clone().count({ count: '*' }).first();
    const employees = await query.limit(parseInt(limit)).offset(offset).orderBy('created_at', 'desc');
    
    res.json({
      success: true,
      data: {
        items: employees,
        pagination: {
          total_items: parseInt(totalEmployees.count),
          total_pages: Math.ceil(totalEmployees.count / limit),
          current_page: parseInt(page),
          limit: parseInt(limit),
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching employees:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch employees.', details: error.message } });
  }
});

// GET /employees/:employee_id - Get employee details
router.get('/:employee_id', checkJwt, syncUser, checkRoleAdmin, async (req, res) => {
  const { tenant_id } = req.auth.payload;
  const { employee_id } = req.params;

  try {
    const employee = await knex('employees')
      .where({ tenant_id, employee_id, deleted_at: null })
      .first();

    if (!employee) {
      return res.status(404).json({ success: false, error: { message: 'Employee not found.' } });
    }
    res.json({ success: true, data: employee });
  } catch (error) {
    logger.error(`Error fetching employee ${employee_id}:`, error);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch employee.', details: error.message } });
  }
});

// PATCH /employees/:employee_id - Update employee
router.patch('/:employee_id', checkJwt, syncUser, checkRoleAdmin, async (req, res) => {
  const { tenant_id, user_id: updated_by } = req.auth.payload; // user_id for audit if needed
  const { employee_id } = req.params;
  const { email, first_name, last_name, status } = req.body;

  // Construct update object with only provided fields
  const updateData = {};
  if (email) updateData.email = email;
  if (first_name) updateData.first_name = first_name;
  if (last_name) updateData.last_name = last_name;
  if (status) updateData.status = status;

  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({ success: false, error: { message: 'No update fields provided.' } });
  }

  try {
    // If email is being updated, check for uniqueness
    if (email) {
      const existingEmployee = await knex('employees')
        .where({ tenant_id, email, deleted_at: null })
        .whereNot({ employee_id })
        .first();
      if (existingEmployee) {
        return res.status(409).json({ success: false, error: { message: 'Another employee with this email already exists.' } });
      }
    }

    const updatedCount = await knex('employees')
      .where({ tenant_id, employee_id, deleted_at: null })
      .update(updateData);

    if (updatedCount === 0) {
      return res.status(404).json({ success: false, error: { message: 'Employee not found or no changes made.' } });
    }

    const updatedEmployee = await knex('employees').where({ employee_id }).first();
    logger.info(`Employee updated: ${employee_id} by user ${updated_by} for tenant ${tenant_id}`);
    // TODO: Add audit log entry
    res.json({ success: true, data: updatedEmployee });
  } catch (error) {
    logger.error(`Error updating employee ${employee_id}:`, error);
    res.status(500).json({ success: false, error: { message: 'Failed to update employee.', details: error.message } });
  }
});

// DELETE /employees/:employee_id - Soft delete employee
router.delete('/:employee_id', checkJwt, syncUser, checkRoleAdmin, async (req, res) => {
  const { tenant_id, user_id: deleted_by } = req.auth.payload;
  const { employee_id } = req.params;

  try {
    // Check if there are active grants for this employee
    // const activeGrants = await knex('grants')
    //   .where({ tenant_id, employee_id, status: 'active', deleted_at: null })
    //   .first();
    // if (activeGrants) {
    //   return res.status(400).json({ success: false, error: { message: 'Cannot delete employee with active grants. Terminate grants first.' } });
    // }
    // Note: SPECIFICATION.md does not explicitly state this check for employee deletion.
    // Soft deleting an employee might just mark them as inactive, grants might remain or be handled separately.
    // For now, proceeding with simple soft delete.

    const updatedCount = await knex('employees')
      .where({ tenant_id, employee_id, deleted_at: null })
      .update({ deleted_at: new Date().toISOString(), status: 'inactive' }); // Also set status to inactive

    if (updatedCount === 0) {
      return res.status(404).json({ success: false, error: { message: 'Employee not found.' } });
    }
    
    logger.info(`Employee soft-deleted: ${employee_id} by user ${deleted_by} for tenant ${tenant_id}`);
    // TODO: Add audit log entry
    res.json({ success: true, data: { message: 'Employee deactivated successfully.' } });
  } catch (error) {
    logger.error(`Error deleting employee ${employee_id}:`, error);
    res.status(500).json({ success: false, error: { message: 'Failed to delete employee.', details: error.message } });
  }
});

// POST /employees/bulk - Bulk create employees
router.post('/bulk', checkJwt, syncUser, checkRoleAdmin, async (req, res) => {
  const { employees: employeeList } = req.body;
  const { tenant_id, user_id: created_by } = req.auth.payload;

  if (!Array.isArray(employeeList) || employeeList.length === 0) {
    return res.status(400).json({ success: false, error: { message: 'Input must be a non-empty array of employees.' } });
  }

  if (employeeList.length > 100) { // As per api.yml maxItems
    return res.status(400).json({ success: false, error: { message: 'Cannot create more than 100 employees at a time.' } });
  }

  const createdEmployees = [];
  const errors = [];

  // Validate all employees first
  for (let i = 0; i < employeeList.length; i++) {
    const emp = employeeList[i];
    if (!emp.email || !emp.first_name || !emp.last_name) {
      errors.push({ index: i, message: 'Missing required fields (email, first_name, last_name).' });
    }
    // Add more validation if needed (e.g., email format)
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, error: { message: 'Validation errors in employee list.', details: errors } });
  }

  try {
    await knex.transaction(async (trx) => {
      for (let i = 0; i < employeeList.length; i++) {
        const empData = employeeList[i];
        
        // Check for existing email within this tenant
        const existingEmployee = await trx('employees')
          .where({ tenant_id, email: empData.email, deleted_at: null })
          .first();

        if (existingEmployee) {
          errors.push({ email: empData.email, message: 'Employee with this email already exists.' });
          continue; // Skip this employee
        }

        const employee_id = uuidv4();
        const newEmployee = {
          employee_id,
          tenant_id,
          email: empData.email,
          first_name: empData.first_name,
          last_name: empData.last_name,
          status: 'active',
          created_by,
          created_at: new Date().toISOString(),
        };
        
        await trx('employees').insert(newEmployee);
        createdEmployees.push(newEmployee); // Add successfully created employee (without sensitive data if any)
        // TODO: Add audit log entry for each creation
      }

      // If any errors occurred (e.g. duplicates found mid-transaction),
      // we might choose to roll back or report partial success.
      // For now, if any non-insert error happens, trx will roll back.
      // Duplicate errors are collected and reported.
    });

    logger.info(`${createdEmployees.length} employees bulk created for tenant ${tenant_id} by user ${created_by}. ${errors.length} skipped.`);
    
    if (errors.length > 0 && createdEmployees.length === 0) {
      // All failed due to duplicates or other pre-insert checks handled by continuing
      return res.status(409).json({ success: false, error: { message: 'All employees in bulk request failed processing.', details: errors } });
    }
    
    // Partial success or full success
    res.status(201).json({ 
      success: true, 
      data: { 
        created_count: createdEmployees.length, 
        employees: createdEmployees,
        errors: errors.length > 0 ? errors : undefined // Only include errors if there are any
      } 
    });

  } catch (error) {
    logger.error('Error during bulk employee creation:', error);
    res.status(500).json({ success: false, error: { message: 'Failed during bulk employee creation.', details: error.message } });
  }
});

// GET /employees/:employee_id/grants-summary - Get employee grants summary
router.get('/:employee_id/grants-summary', checkJwt, syncUser, checkRoleAdmin, async (req, res) => {
  const { tenant_id } = req.auth.payload;
  const { employee_id } = req.params;

  try {
    // Fetch employee to ensure they exist and belong to the tenant
    const employee = await knex('employees')
      .where({ tenant_id, employee_id, deleted_at: null })
      .first();

    if (!employee) {
      return res.status(404).json({ success: false, error: { message: 'Employee not found.' } });
    }

    // Fetch all active grants for this employee
    const grants = await knex('grants')
      .where({ tenant_id, employee_id, status: 'active', deleted_at: null })
      .orderBy('grant_date', 'desc');

    let total_shares = 0;
    let total_vested = 0;

    grants.forEach(grant => {
      total_shares += parseFloat(grant.share_amount);
      total_vested += parseFloat(grant.vested_amount);
    });
    total_shares = parseFloat(total_shares.toFixed(3));
    total_vested = parseFloat(total_vested.toFixed(3));
    const total_unvested = parseFloat((total_shares - total_vested).toFixed(3));

    // Fetch current PPS
    let currentPPSValue = '0.000';
    const ppsRecord = await knex('pps_history')
      .where('tenant_id', tenant_id)
      .andWhere('effective_date', '<=', knex.fn.now())
      .orderBy([
        { column: 'effective_date', order: 'desc' },
        { column: 'created_at', order: 'desc' }
      ])
      .first();
    if (ppsRecord) {
      currentPPSValue = ppsRecord.price_per_share;
    }
    
    const total_vested_value = parseFloat((total_vested * parseFloat(currentPPSValue)).toFixed(3));

    const summaryData = {
      employee_id,
      total_grants: grants.length,
      total_shares: total_shares.toFixed(3),
      total_vested: total_vested.toFixed(3),
      total_unvested: total_unvested.toFixed(3),
      current_pps: currentPPSValue,
      total_vested_value: total_vested_value.toFixed(3),
      grants: grants, // Include the full grant objects
    };

    res.json({ success: true, data: summaryData });

  } catch (error) {
    logger.error(`Error fetching grants summary for employee ${employee_id}:`, error);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch grants summary.', details: error.message } });
  }
});

module.exports = router;
