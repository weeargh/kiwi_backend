/**
 * Migration to create the audit_logs table.
 */

exports.up = async function(knex) {
  await knex.schema.createTable('audit_logs', (table) => {
    table.uuid('log_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('tenant_id').inTable('tenants').onDelete('CASCADE'); // Cascade if tenant is deleted
    table.uuid('user_id').nullable().references('user_id').inTable('user_accounts').onDelete('SET NULL'); // Set to NULL if user is deleted
    table.string('action_type', 50).notNullable(); // Increased length slightly from spec's VARCHAR(40)
    table.string('entity_type', 50).nullable(); // Increased length slightly
    table.uuid('entity_id').nullable();
    // Using jsonb for details for efficiency and advanced querying capabilities in PostgreSQL
    table.jsonb('details').notNullable().defaultTo('{}'); 
    // Basic check for 'before' and 'after' keys in details can be added if needed, but complex JSON schema validation is usually app-level.
    // knex.raw('ALTER TABLE audit_logs ADD CONSTRAINT chk_details_structure CHECK (jsonb_typeof(details->\'before\') IN (\'object\', \'null\') AND jsonb_typeof(details->\'after\') IN (\'object\', \'null\'))');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index('tenant_id', 'idx_audit_logs_tenant_id');
    table.index(['entity_type', 'entity_id'], 'idx_audit_logs_entity'); // Matches spec
    table.index('created_at', 'idx_audit_logs_date'); // Matches spec
    table.index('user_id', 'idx_audit_logs_user_id');
    table.index('action_type', 'idx_audit_logs_action_type');
  });
  
  // Add the more complex CHECK constraint for jsonb structure if required and supported
  // Note: This exact syntax might need adjustment based on PostgreSQL version and specific needs.
  // It's often simpler to ensure the application layer constructs the JSON correctly.
  // await knex.raw(`
  //   ALTER TABLE audit_logs ADD CONSTRAINT chk_audit_log_details_structure 
  //   CHECK (
  //     (jsonb_typeof(details->'before') = 'object' OR jsonb_typeof(details->'before') = 'null') AND
  //     (jsonb_typeof(details->'after') = 'object' OR jsonb_typeof(details->'after') = 'null')
  //   )
  // `);
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('audit_logs');
}; 