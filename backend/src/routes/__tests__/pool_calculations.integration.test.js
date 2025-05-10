/**
 * Integration tests for Pool Calculations
 * Verifies the invariant constraints from the specification:
 * - Total Pool = initial_amount + Σ(pool_events.amount)
 * - Available = TotalPool - Granted + Returned
 * - 0 ≤ Available ≤ TotalPool must always hold
 */
const IntegrationTestBase = require('../../__tests__/integration-test-base');
const { v4: uuidv4 } = require('uuid');

class PoolCalculationTest extends IntegrationTestBase {
  constructor() {
    super();
    this.poolsBasePath = '/api/pools';
    this.poolEventsBasePath = (poolId) => `/api/pools/${poolId}/events`;
    this.grantsBasePath = '/api/grants';
  }

  /**
   * Helper to get current pool metrics
   */
  async getPoolMetrics() {
    const res = await this
      .getAuthenticatedRequest(this.defaultAdminId, 'admin')
      .get(this.poolsBasePath)
      .expect(200);
    
    return res.body.data;
  }

  /**
   * Helper to create a pool event
   */
  async createPoolEvent(poolId, eventData) {
    const res = await this
      .getAuthenticatedRequest(this.defaultAdminId, 'admin')
      .post(this.poolEventsBasePath(poolId))
      .send(eventData)
      .expect(201);
    
    return res.body.data;
  }
}

// Create test instance
const testBase = new PoolCalculationTest();

describe('Pool Calculation Invariants', () => {
  // Start transaction before each test for isolation
  beforeEach(async () => {
    await testBase.setup();
  });

  // Rollback transaction after each test
  afterEach(async () => {
    await testBase.teardown();
  });

  /**
   * Critical test for the main pool calculation invariant
   * Verifies that Total Pool = initial_amount + Σ(pool_events.amount)
   */
  it('should maintain Total Pool = initial_amount + Σ(pool_events.amount)', async () => {
    // Create a new pool with known initial amount
    const initialAmount = '1000.000';
    const pool = await testBase.createTestPool({ initial_amount: initialAmount });
    
    // Verify initial pool metrics
    let metrics = await testBase.getPoolMetrics();
    expect(metrics.total_pool).toBe(initialAmount);
    expect(metrics.available_shares).toBe(initialAmount); // No grants yet
    
    // Add top-up event
    const topUpAmount = '500.000';
    await testBase.createPoolEvent(pool.pool_id, {
      event_type: 'top_up',
      amount: topUpAmount,
      effective_date: '2025-01-01',
      notes: 'Test top-up'
    });
    
    // Verify pool metrics after top-up
    metrics = await testBase.getPoolMetrics();
    const expectedTotal = (parseFloat(initialAmount) + parseFloat(topUpAmount)).toFixed(3);
    expect(metrics.total_pool).toBe(expectedTotal);
    expect(metrics.available_shares).toBe(expectedTotal); // Still no grants
    
    // Add reduction event
    const reductionAmount = '200.000';
    await testBase.createPoolEvent(pool.pool_id, {
      event_type: 'reduction',
      amount: reductionAmount,
      effective_date: '2025-01-02',
      notes: 'Test reduction'
    });
    
    // Verify pool metrics after reduction
    metrics = await testBase.getPoolMetrics();
    const expectedTotalAfterReduction = (parseFloat(expectedTotal) - parseFloat(reductionAmount)).toFixed(3);
    expect(metrics.total_pool).toBe(expectedTotalAfterReduction);
    expect(metrics.available_shares).toBe(expectedTotalAfterReduction);
    
    // Verify via direct database query to confirm integrity
    const poolEventsQuery = await testBase.query(
      `SELECT SUM(CASE WHEN event_type = 'initial' OR event_type = 'top_up' THEN amount 
              WHEN event_type = 'reduction' THEN -amount
              ELSE 0 END) as calculated_total
       FROM pool_events 
       WHERE pool_id = $1`,
      [pool.pool_id]
    );
    
    // Compare the API-reported total with the database-calculated total
    const dbCalculatedTotal = parseFloat(poolEventsQuery.rows[0].calculated_total).toFixed(3);
    expect(metrics.total_pool).toBe(dbCalculatedTotal);
  });

  /**
   * Verifies the second invariant: Available = TotalPool - Granted + Returned
   */
  it('should maintain Available = TotalPool - Granted + Returned', async () => {
    // Create a new pool with known initial amount
    const initialAmount = '1000.000';
    const pool = await testBase.createTestPool({ initial_amount: initialAmount });
    
    // Create test employees for grants
    const employee1 = await testBase.createTestEmployee();
    const employee2 = await testBase.createTestEmployee();
    
    // Create first grant
    const grant1Amount = '250.000';
    const grant1 = await testBase.createTestGrant(employee1, { share_amount: grant1Amount });
    
    // Verify pool metrics after first grant
    let metrics = await testBase.getPoolMetrics();
    expect(metrics.total_pool).toBe(initialAmount);
    expect(metrics.granted_shares).toBe(grant1Amount);
    const expectedAvailable1 = (parseFloat(initialAmount) - parseFloat(grant1Amount)).toFixed(3);
    expect(metrics.available_shares).toBe(expectedAvailable1);
    
    // Create second grant
    const grant2Amount = '350.000';
    const grant2 = await testBase.createTestGrant(employee2, { share_amount: grant2Amount });
    
    // Verify pool metrics after second grant
    metrics = await testBase.getPoolMetrics();
    const totalGranted = (parseFloat(grant1Amount) + parseFloat(grant2Amount)).toFixed(3);
    expect(metrics.granted_shares).toBe(totalGranted);
    const expectedAvailable2 = (parseFloat(initialAmount) - parseFloat(totalGranted)).toFixed(3);
    expect(metrics.available_shares).toBe(expectedAvailable2);
    
    // Terminate first grant to simulate returning unvested shares
    const returnedAmount = '150.000';
    await testBase.query(
      `UPDATE grants 
       SET status = 'inactive', 
           unvested_shares_returned = $1, 
           termination_date = CURRENT_DATE 
       WHERE grant_id = $2`,
      [returnedAmount, grant1.grant_id]
    );
    
    // Verify pool metrics after termination
    metrics = await testBase.getPoolMetrics();
    expect(metrics.returned_shares).toBe(returnedAmount);
    
    // Final available calculation: TotalPool - Granted + Returned
    const expectedFinalAvailable = (
      parseFloat(initialAmount) - 
      parseFloat(totalGranted) + 
      parseFloat(returnedAmount)
    ).toFixed(3);
    
    expect(metrics.available_shares).toBe(expectedFinalAvailable);
    
    // Verify the invariant 0 ≤ Available ≤ TotalPool
    const availableNum = parseFloat(metrics.available_shares);
    const totalPoolNum = parseFloat(metrics.total_pool);
    expect(availableNum).toBeGreaterThanOrEqual(0);
    expect(availableNum).toBeLessThanOrEqual(totalPoolNum);
  });

  /**
   * Verifies that the system prevents grants when available shares are insufficient
   */
  it('should reject grants when Available < requested share_amount', async () => {
    // Create a pool with limited shares
    const initialAmount = '100.000';
    await testBase.createTestPool({ initial_amount: initialAmount });
    
    // Create test employee
    const employee = await testBase.createTestEmployee();
    
    // Try to create a grant for more shares than available
    const excessiveAmount = '150.000'; // More than pool total
    
    // Attempt to create grant
    const response = await testBase
      .getAuthenticatedRequest(testBase.defaultAdminId, 'admin')
      .post(testBase.grantsBasePath)
      .send({
        employee_id: employee.employee_id,
        grant_date: '2025-01-01',
        share_amount: excessiveAmount,
        notes: 'This should fail'
      })
      .expect(400); // Expect failure
    
    // Verify error code
    expect(response.body.error.code).toBe('INSUFFICIENT_SHARES');
    
    // Verify pool remained unchanged
    const metrics = await testBase.getPoolMetrics();
    expect(metrics.total_pool).toBe(initialAmount);
    expect(metrics.granted_shares).toBe('0.000'); // No shares granted
    expect(metrics.available_shares).toBe(initialAmount); // All shares still available
  });

  /**
   * Verifies that the system prevents pool reductions below granted amount
   */
  it('should reject pool reductions that would make Available < 0', async () => {
    // Create a pool
    const initialAmount = '500.000';
    const pool = await testBase.createTestPool({ initial_amount: initialAmount });
    
    // Create a grant using half the pool
    const grantAmount = '250.000';
    const employee = await testBase.createTestEmployee();
    await testBase.createTestGrant(employee, { share_amount: grantAmount });
    
    // Verify current metrics
    let metrics = await testBase.getPoolMetrics();
    expect(metrics.granted_shares).toBe(grantAmount);
    expect(metrics.available_shares).toBe('250.000'); // 500 - 250
    
    // Try to reduce the pool by more than available (which would make Available < 0)
    const excessiveReduction = '300.000'; // More than available
    
    // Attempt pool reduction
    const response = await testBase
      .getAuthenticatedRequest(testBase.defaultAdminId, 'admin')
      .post(testBase.poolEventsBasePath(pool.pool_id))
      .send({
        event_type: 'reduction',
        amount: excessiveReduction,
        effective_date: '2025-01-01',
        notes: 'This should fail'
      })
      .expect(400); // Expect failure
    
    // Verify error code
    expect(response.body.error.code).toBe('INSUFFICIENT_AVAILABLE_SHARES');
    
    // Verify pool remained unchanged
    metrics = await testBase.getPoolMetrics();
    expect(metrics.total_pool).toBe(initialAmount);
    expect(metrics.granted_shares).toBe(grantAmount);
    expect(metrics.available_shares).toBe('250.000'); // Still 250 available
  });

  /**
   * Verifies the immutability of historical pool events
   */
  it('should preserve the immutability of pool events', async () => {
    // Create a new pool
    const pool = await testBase.createTestPool({ initial_amount: '1000.000' });
    
    // Create a pool event
    const eventData = {
      event_type: 'top_up',
      amount: '500.000',
      effective_date: '2025-01-01',
      notes: 'Original notes'
    };
    
    // Create event
    const createdEvent = await testBase.createPoolEvent(pool.pool_id, eventData);
    
    // Try to update the event
    const updateResult = await testBase.query(
      `UPDATE pool_events 
       SET notes = 'Modified notes', amount = '600.000'
       WHERE event_id = $1
       RETURNING *`,
      [createdEvent.event_id]
    );
    
    // Look up the event via API
    const eventResponse = await testBase
      .getAuthenticatedRequest(testBase.defaultAdminId, 'admin')
      .get(`${testBase.poolEventsBasePath(pool.pool_id)}/${createdEvent.event_id}`)
      .expect(200);
    
    // Verify event data is preserved as originally created
    const retrievedEvent = eventResponse.body.data;
    expect(retrievedEvent.amount).toBe(eventData.amount);
    expect(retrievedEvent.notes).toBe(eventData.notes);
    
    // Also verify the pool total is still calculated correctly
    const metrics = await testBase.getPoolMetrics();
    const expectedTotal = '1500.000'; // 1000 initial + 500 top-up
    expect(metrics.total_pool).toBe(expectedTotal);
  });
});
