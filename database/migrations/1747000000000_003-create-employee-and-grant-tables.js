exports.up = async function(knex) {
  await knex.schema.createTable('employees', function(table) {
    table.uuid('employee_id').primary();
    table.uuid('tenant_id').notNullable().references('tenant_id').inTable('tenants').onDelete('CASCADE');
    table.string('email', 255).notNullable();
    table.string('first_name', 50).notNullable();
    table.string('last_name', 50).notNullable();
    table.enum('status', ['active', 'inactive'], { useNative: true, enumName: 'employee_status_type' }).notNullable().defaultTo('active');
    table.uuid('created_by').references('user_id').inTable('user_accounts').onDelete('SET NULL'); // Or RESTRICT
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable();
    // Use regular index instead of partial
    table.index(['tenant_id', 'status'], 'idx_employees_tenant_status');
  });

  // Create partial unique index using raw SQL for PostgreSQL
  await knex.raw(`
    CREATE UNIQUE INDEX idx_employees_tenant_email_unique
    ON employees (tenant_id, email)
    WHERE deleted_at IS NULL;
  `);

  await knex.schema.createTable('grants', function(table) {
    table.uuid('grant_id').primary();
    table.uuid('tenant_id').notNullable().references('tenant_id').inTable('tenants').onDelete('CASCADE');
    table.uuid('employee_id').notNullable().references('employee_id').inTable('employees').onDelete('CASCADE');
    table.date('grant_date').notNullable();
    table.decimal('share_amount', 12, 3).notNullable();
    table.decimal('vested_amount', 12, 3).notNullable().defaultTo(0.000);
    table.enum('status', ['active', 'inactive'], { useNative: true, enumName: 'grant_status_type' }).notNullable().defaultTo('active');
    table.date('termination_date').nullable();
    table.decimal('unvested_shares_returned', 12, 3).notNullable().defaultTo(0.000);
    table.text('termination_reason').nullable();
    table.uuid('terminated_by').nullable().references('user_id').inTable('user_accounts').onDelete('SET NULL'); // Or RESTRICT
    table.integer('version').notNullable().defaultTo(0);
    table.uuid('created_by').notNullable().references('user_id').inTable('user_accounts').onDelete('SET NULL'); // Or RESTRICT
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable();

    // Indexes from SPECIFICATION.md
    // Basic indices without partial conditions
    table.index(['employee_id', 'status'], 'idx_grants_employee_id_status'); 
    table.index(['tenant_id', 'status'], 'idx_grants_tenant_status'); 
    
    // Check constraint for share_amount > 0
    table.check('?? > 0', ['share_amount']);
  });

  // Create partial indexes using raw SQL for PostgreSQL
  await knex.raw(`
    CREATE INDEX idx_grants_employee_id_status_partial
    ON grants (employee_id, status)
    WHERE deleted_at IS NULL;
  `);
  
  await knex.raw(`
    CREATE INDEX idx_grants_tenant_status_partial
    ON grants (tenant_id, status)
    WHERE deleted_at IS NULL;
  `);
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('grants');
  await knex.schema.dropTableIfExists('employees');
  // Manually drop enum types if they were created with `useNative: true` and DB is PostgreSQL
  await knex.raw('DROP TYPE IF EXISTS employee_status_type;');
  await knex.raw('DROP TYPE IF EXISTS grant_status_type;');
};
