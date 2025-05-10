/**
 * Migration to create equity pools, pool events, and price per share history tables
 * for Stage 2 - Equity Pool & Price Per Share (PPS) Management
 * Converted to Knex.js syntax.
 */

exports.up = async function(knex) {
  // Create equity_pools table
  await knex.schema.createTable('equity_pools', (table) => {
    table.uuid('pool_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('tenant_id').inTable('tenants').onDelete('RESTRICT');
    table.decimal('initial_amount', 12, 3).notNullable();
    table.decimal('total_pool', 12, 3).notNullable();
    table.uuid('created_by').notNullable().references('user_id').inTable('user_accounts').onDelete('RESTRICT');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable();

    // Indexes
    table.index('tenant_id', 'idx_equity_pools_tenant_id');
  });

  // Add CHECK constraints for equity_pools using knex.raw
  await knex.raw('ALTER TABLE equity_pools ADD CONSTRAINT chk_initial_amount_positive CHECK (initial_amount > 0)');
  await knex.raw('ALTER TABLE equity_pools ADD CONSTRAINT chk_total_pool_positive CHECK (total_pool >= 0)');

  // Create pool_events table
  await knex.schema.createTable('pool_events', (table) => {
    table.uuid('event_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('pool_id').notNullable().references('pool_id').inTable('equity_pools').onDelete('CASCADE'); // Cascade delete if pool is deleted
    table.uuid('tenant_id').notNullable().references('tenant_id').inTable('tenants').onDelete('RESTRICT');
    table.decimal('amount', 12, 3).notNullable();
    table.text('event_type').notNullable(); // CHECK constraint added below
    table.date('effective_date').notNullable();
    table.text('notes').nullable();
    table.uuid('created_by').notNullable().references('user_id').inTable('user_accounts').onDelete('RESTRICT');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index('pool_id', 'idx_pool_events_pool_id');
    table.index('tenant_id', 'idx_pool_events_tenant_id');
    table.index('effective_date', 'idx_pool_events_effective_date');
  });
  
  await knex.raw("ALTER TABLE pool_events ADD CONSTRAINT chk_event_type CHECK (event_type IN ('initial', 'top_up', 'reduction'))");

  // Create pps_history table
  await knex.schema.createTable('pps_history', (table) => {
    table.uuid('pps_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('tenant_id').inTable('tenants').onDelete('RESTRICT');
    table.date('effective_date').notNullable();
    table.decimal('price_per_share', 12, 3).notNullable();
    table.uuid('created_by').notNullable().references('user_id').inTable('user_accounts').onDelete('RESTRICT');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable();
  });
  
  await knex.raw('ALTER TABLE pps_history ADD CONSTRAINT chk_price_per_share_positive CHECK (price_per_share > 0)');

  // Create the composite index for efficient PPS lookup using knex.raw for DESC ordering
  await knex.raw('CREATE INDEX idx_pps_lookup ON pps_history (tenant_id, effective_date DESC, created_at DESC)');

  // Create stored function for pool adjustments (sf_adjust_pool from previous step)
  await knex.raw(`
    CREATE OR REPLACE FUNCTION func_adjust_pool_v3(
      p_pool_id UUID,
      p_tenant_id UUID,
      p_event_type VARCHAR,
      p_amount TEXT,
      p_effective_date DATE,
      p_notes TEXT,
      p_created_by UUID
    )
    RETURNS pool_events
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_amount_for_insert DECIMAL(12,3);
      v_total_pool_before_event DECIMAL(12,3);
      v_available_before_event DECIMAL(12,3);
      v_granted_shares_placeholder DECIMAL(12,3) := 0;
      v_returned_shares_placeholder DECIMAL(12,3) := 0;
      v_created_event pool_events%ROWTYPE;
    BEGIN
      IF current_setting('transaction_isolation') <> 'serializable' THEN
        RAISE EXCEPTION 'sf_adjust_pool must be called within a SERIALIZABLE transaction. Current: %', current_setting('transaction_isolation');
      END IF;

      -- Validate input: Cast text amount to decimal
      BEGIN
        v_amount_for_insert := CAST(p_amount AS DECIMAL(12,3));
      EXCEPTION
        WHEN invalid_text_representation THEN
          RAISE EXCEPTION 'Invalid amount format: %s. Expected text representation of a number.', p_amount;
        WHEN numeric_value_out_of_range THEN
          RAISE EXCEPTION 'Amount %s is out of range for DECIMAL(12,3).', p_amount;
      END;
      
      -- Validate event type
      IF NOT (p_event_type IN ('initial', 'top_up', 'reduction')) THEN
        RAISE EXCEPTION 'Invalid event type: %', p_event_type;
      END IF;

      SELECT ep.total_pool INTO v_total_pool_before_event
      FROM equity_pools ep
      WHERE ep.pool_id = p_pool_id AND ep.tenant_id = p_tenant_id AND ep.deleted_at IS NULL
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Pool not found with ID: % for tenant: %', p_pool_id, p_tenant_id;
      END IF;

      v_available_before_event := v_total_pool_before_event;

      IF p_event_type = 'reduction' AND ABS(v_amount_for_insert) > v_available_before_event THEN
        RAISE EXCEPTION 'Cannot reduce pool by % shares as only % shares are available (current total_pool). Attempted reduction: %, Available: %',
                        ABS(v_amount_for_insert), v_available_before_event, v_amount_for_insert, v_available_before_event;
      END IF;
      
      IF (v_total_pool_before_event + v_amount_for_insert) < 0 THEN
         RAISE EXCEPTION 'Pool total cannot be negative after event. Current total: %, Change: %, Resulting total: %',
                        v_total_pool_before_event, v_amount_for_insert, (v_total_pool_before_event + v_amount_for_insert);
      END IF;

      UPDATE equity_pools
      SET total_pool = total_pool + v_amount_for_insert
      WHERE pool_id = p_pool_id AND tenant_id = p_tenant_id AND deleted_at IS NULL;

      INSERT INTO pool_events (
        pool_id, tenant_id, amount, event_type, effective_date, notes, created_by
      ) VALUES (
        p_pool_id, p_tenant_id, v_amount_for_insert, p_event_type, p_effective_date, p_notes, p_created_by
      ) RETURNING * INTO v_created_event;

      RETURN v_created_event;
    END;
    $$;
  `);
};

exports.down = async function(knex) {
  await knex.raw('DROP FUNCTION IF EXISTS func_adjust_pool_v3(UUID, UUID, VARCHAR, TEXT, DATE, TEXT, UUID)');
  await knex.raw('DROP FUNCTION IF EXISTS func_adjust_pool_v2(UUID, UUID, VARCHAR, DECIMAL, DATE, TEXT, UUID)');
  await knex.raw('DROP FUNCTION IF EXISTS sf_adjust_pool(UUID, UUID, VARCHAR, NUMERIC, DATE, TEXT, UUID)');
  
  // Drop tables in reverse order of creation to handle foreign key constraints
  // Constraints are usually dropped automatically with tables, but explicit drop of index/constraints if needed
  await knex.raw('DROP INDEX IF EXISTS idx_pps_lookup'); 
  // CHECK constraints are typically dropped when the table is dropped.
  // If not, explicit DROP CONSTRAINT commands would be needed here.
  await knex.schema.dropTableIfExists('pps_history');
  await knex.schema.dropTableIfExists('pool_events');
  await knex.schema.dropTableIfExists('equity_pools');
}; 