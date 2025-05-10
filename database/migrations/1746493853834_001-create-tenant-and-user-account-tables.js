/**
 * Migration to create tenant and user account tables
 * Converting from node-pg-migrate to knex
 */

exports.up = async function(knex) {
  // Create extension for UUID generation if it doesn't exist
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

  // Check if user_role type exists
  const userRoleTypeExists = await knex.raw(`
    SELECT EXISTS (
      SELECT 1 FROM pg_type 
      WHERE typname = 'user_role'
    );
  `);

  if (!userRoleTypeExists.rows[0].exists) {
    await knex.raw('CREATE TYPE user_role AS ENUM (\'admin\', \'employee\')');
  }

  // Check if user_status type exists
  const userStatusTypeExists = await knex.raw(`
    SELECT EXISTS (
      SELECT 1 FROM pg_type 
      WHERE typname = 'user_status'
    );
  `);

  if (!userStatusTypeExists.rows[0].exists) {
    await knex.raw('CREATE TYPE user_status AS ENUM (\'active\', \'inactive\')');
  }

  // Tenant Table (if not exists)
  if (!(await knex.schema.hasTable('tenants'))) {
    await knex.schema.createTable('tenants', (table) => {
      table.uuid('tenant_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('name', 100).notNullable();
      table.specificType('currency', 'char(3)').notNullable(); // ISO-4217
      table.string('timezone', 50).notNullable(); // IANA ID
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('deleted_at').nullable();
    });
  }

  // UserAccount Table (if not exists)
  if (!(await knex.schema.hasTable('user_accounts'))) {
    await knex.schema.createTable('user_accounts', (table) => {
      table.uuid('user_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('tenant_id').notNullable().references('tenant_id').inTable('tenants').onDelete('RESTRICT');
      table.string('auth0_user_id', 128).nullable(); // Auth0 subject length can vary
      table.string('email', 255).notNullable();
      table.string('name', 100).notNullable();
      table.specificType('role', 'user_role').notNullable();
      table.specificType('status', 'user_status').notNullable().defaultTo('active');
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('deleted_at').nullable();

      // Indexes
      table.index('tenant_id');
      table.index('auth0_user_id');
    });

    // Add unique partial index for email per tenant (where user is active)
    await knex.raw(`
      CREATE UNIQUE INDEX idx_user_accounts_tenant_id_email_partial
      ON user_accounts (tenant_id, email)
      WHERE deleted_at IS NULL;
    `);

    // Add unique partial index for auth0_user_id per tenant (where user is active and auth0_user_id is not null)
    // NOTE: The original constraint didn't check for auth0_user_id IS NOT NULL, but it's often desired.
    // Including it here for better data integrity.
    await knex.raw(`
      CREATE UNIQUE INDEX idx_user_accounts_tenant_id_auth0_user_id_partial
      ON user_accounts (tenant_id, auth0_user_id)
      WHERE deleted_at IS NULL AND auth0_user_id IS NOT NULL;
    `);
  }

  // Check if the default tenant exists before inserting
  const existingTenant = await knex('tenants')
    .where({ tenant_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
    .first();

  if (!existingTenant) {
    // Seed a default tenant
    await knex('tenants').insert({
      tenant_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      name: 'Testt Co',
      currency: 'USD',
      timezone: 'Asia/Bangkok'
    });
  }
};

exports.down = async function(knex) {
  // We'll keep the down migration as is, since it already uses IF EXISTS
  
  // Remove the seeded tenant if it exists
  await knex('tenants').where({ tenant_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' }).del();

  // Drop indices before dropping tables
  await knex.raw('DROP INDEX IF EXISTS idx_user_accounts_tenant_id_auth0_user_id_partial;');
  await knex.raw('DROP INDEX IF EXISTS idx_user_accounts_tenant_id_email_partial;');
  
  // Drop tables
  await knex.schema.dropTableIfExists('user_accounts');
  await knex.schema.dropTableIfExists('tenants');
  
  // Drop types
  await knex.raw('DROP TYPE IF EXISTS user_status');
  await knex.raw('DROP TYPE IF EXISTS user_role');
};
