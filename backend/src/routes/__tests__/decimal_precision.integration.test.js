/**
 * Integration tests for DECIMAL(12,3) Precision Handling
 * Verifies that all financial values maintain the required precision
 * throughout all operations as specified in the requirements.
 */
const IntegrationTestBase = require('../../__tests__/integration-test-base');
const { v4: uuidv4 } = require('uuid');

class DecimalPrecisionTest extends IntegrationTestBase {
  constructor() {
    super();
    this.poolsBasePath = '/api/pools';
    this.grantsBasePath = '/api/grants';
    this.ppsBasePath = '/api/pps';
  }
}

// Create test instance
const testBase = new DecimalPrecisionTest();

describe('Decimal Precision Tests', () => {
  // Start transaction before each test for isolation
  beforeEach(async () => {
    await testBase.setup();
  });

  // Rollback transaction after each test
  afterEach(async () => {
    await testBase.teardown();
  });

  /**
   * Verifies DECIMAL(12,3) precision for pool amounts
   */
  it('should correctly handle DECIMAL(12,3) precision for pool amounts', async () => {
    // Test with maximum precision value
    const maxPrecisionValue = '999999999.999'; // 9 digits + 3 decimal places
    
    // Create a pool with precise value
    const pool = await testBase.createTestPool({ initial_amount: maxPrecisionValue });
    
    // Get pool via API
    const response = await testBase
      .getAuthenticatedRequest(testBase.defaultAdminId, 'admin')
      .get(testBase.poolsBasePath)
      .expect(200);
    
    // Verify precision is maintained
    expect(response.body.data.total_pool).toBe(maxPrecisionValue);
    expect(response.body.data.available_shares).toBe(maxPrecisionValue);
    
    // Verify via direct database query
    const poolQuery = await testBase.query(
      `SELECT total_shares FROM equity_pools WHERE pool_id = $1`,
      [pool.pool_id]
    );
    
    expect(poolQuery.rows[0].total_shares.toString()).toBe(maxPrecisionValue);
  });

  /**
   * Verifies DECIMAL(12,3) precision for tiny amounts
   */
  it('should correctly handle minimum decimal precision (0.001)', async () => {
    // Test with minimum precision value
    const minPrecisionValue = '0.001'; // Smallest valid amount
    
    // Create a pool with that amount
    const pool = await testBase.createTestPool({ initial_amount: minPrecisionValue });
    
    // Create a pool event with same tiny value
    await testBase
      .getAuthenticatedRequest(testBase.defaultAdminId, 'admin')
      .post(`${testBase.poolsBasePath}/${pool.pool_id}/events`)
      .send({
        event_type: 'top_up',
        amount: minPrecisionValue,
        effective_date: '2025-01-01',
        notes: 'Testing minimum value'
      })
      .expect(201);
    
    // Get updated pool via API
    const response = await testBase
      .getAuthenticatedRequest(testBase.defaultAdminId, 'admin')
      .get(testBase.poolsBasePath)
      .expect(200);
    
    // Expected result should be 0.001 + 0.001 = 0.002
    const expectedResult = '0.002';
    expect(response.body.data.total_pool).toBe(expectedResult);
    
    // Create an employee for grant test
    const employee = await testBase.createTestEmployee();
    
    // Create a grant with tiny value
    const grantResponse = await testBase
      .getAuthenticatedRequest(testBase.defaultAdminId, 'admin')
      .post(testBase.grantsBasePath)
      .send({
        employee_id: employee.employee_id,
        grant_date: '2025-01-01',
        share_amount: minPrecisionValue,
        notes: 'Testing minimum grant value'
      })
      .expect(201);
    
    // Verify precision is maintained in grant
    expect(grantResponse.body.data.share_amount).toBe(minPrecisionValue);
  });

  /**
   * Verifies rejection of sub-minimum precision values
   */
  it('should reject values with precision smaller than 0.001', async () => {
    // Test with invalid precision value
    const invalidPrecisionValue = '0.0001'; // Too small
    
    // Try to create a pool with invalid value
    const poolResponse = await testBase
      .getAuthenticatedRequest(testBase.defaultAdminId, 'admin')
      .post(testBase.poolsBasePath)
      .send({
        initial_amount: invalidPrecisionValue,
        created_by: testBase.defaultAdminId
      })
      .expect(400); // Should fail validation
    
    // Check error code
    expect(poolResponse.body.error.code).toBe('VALIDATION_ERROR');
    
    // Create valid pool for next test
    const pool = await testBase.createTestPool({ initial_amount: '1.000' });
    
    // Try to create a pool event with invalid value
    const eventResponse = await testBase
      .getAuthenticatedRequest(testBase.defaultAdminId, 'admin')
      .post(`${testBase.poolsBasePath}/${pool.pool_id}/events`)
      .send({
        event_type: 'top_up',
        amount: invalidPrecisionValue,
        effective_date: '2025-01-01',
        notes: 'Testing invalid value'
      })
      .expect(400); // Should fail validation
    
    // Check error code
    expect(eventResponse.body.error.code).toBe('VALIDATION_ERROR');
  });

  /**
   * Verifies DECIMAL(12,3) precision in price per share values
   */
  it('should correctly handle DECIMAL(12,3) precision for price per share', async () => {
    // Test with precise decimal value
    const preciseValue = '123456.789'; // Test significant decimal precision
    
    // Create a PPS entry with precise value
    const ppsResponse = await testBase
      .getAuthenticatedRequest(testBase.defaultAdminId, 'admin')
      .post(testBase.ppsBasePath)
      .send({
        effective_date: '2025-01-01',
        price_per_share: preciseValue,
        notes: 'Testing precise PPS value'
      })
      .expect(201);
    
    // Verify precision is maintained
    expect(ppsResponse.body.data.price_per_share).toBe(preciseValue);
    
    // Verify via direct database query
    const ppsQuery = await testBase.query(
      `SELECT price_per_share FROM pps_history WHERE pps_id = $1`,
      [ppsResponse.body.data.pps_id]
    );
    
    expect(ppsQuery.rows[0].price_per_share.toString()).toBe(preciseValue);
  });

  /**
   * Verifies precision is maintained through arithmetic operations
   */
  it('should maintain precision through arithmetic operations', async () => {
    // Create pool with precise value
    const initialAmount = '1000.123';
    const pool = await testBase.createTestPool({ initial_amount: initialAmount });
    
    // Add a series of precise events to test arithmetic
    const topUp1 = '123.456';
    const topUp2 = '789.012';
    const reduction = '234.567';
    
    // Create first top-up
    await testBase
      .getAuthenticatedRequest(testBase.defaultAdminId, 'admin')
      .post(`${testBase.poolsBasePath}/${pool.pool_id}/events`)
      .send({
        event_type: 'top_up',
        amount: topUp1,
        effective_date: '2025-01-01',
        notes: 'First top-up'
      })
      .expect(201);
    
    // Create second top-up
    await testBase
      .getAuthenticatedRequest(testBase.defaultAdminId, 'admin')
      .post(`${testBase.poolsBasePath}/${pool.pool_id}/events`)
      .send({
        event_type: 'top_up',
        amount: topUp2,
        effective_date: '2025-01-02',
        notes: 'Second top-up'
      })
      .expect(201);
    
    // Create reduction
    await testBase
      .getAuthenticatedRequest(testBase.defaultAdminId, 'admin')
      .post(`${testBase.poolsBasePath}/${pool.pool_id}/events`)
      .send({
        event_type: 'reduction',
        amount: reduction,
        effective_date: '2025-01-03',
        notes: 'Test reduction'
      })
      .expect(201);
    
    // Manually calculate expected result to 3 decimal places
    const expected = (
      parseFloat(initialAmount) + 
      parseFloat(topUp1) + 
      parseFloat(topUp2) - 
      parseFloat(reduction)
    ).toFixed(3);
    
    // Get updated pool via API
    const response = await testBase
      .getAuthenticatedRequest(testBase.defaultAdminId, 'admin')
      .get(testBase.poolsBasePath)
      .expect(200);
    
    // Verify precision is maintained through multiple operations
    expect(response.body.data.total_pool).toBe(expected);
  });

  /**
   * Verifies precision in vesting calculations
   */
  it('should maintain precision in vesting calculations', async () => {
    // Create employee
    const employee = await testBase.createTestEmployee();
    
    // Create grant with value that would cause decimal division
    // 1000/48 = 20.833... per month
    const grantAmount = '1000.000';
    const grantResponse = await testBase
      .getAuthenticatedRequest(testBase.defaultAdminId, 'admin')
      .post(testBase.grantsBasePath)
      .send({
        employee_id: employee.employee_id,
        grant_date: '2024-01-01', // 1 year ago to pass cliff
        share_amount: grantAmount,
        notes: 'Testing vesting precision'
      })
      .expect(201);
    
    const grantId = grantResponse.body.data.grant_id;
    
    // Calculate vesting at cliff (12 months)
    const vestingResponse = await testBase
      .getAuthenticatedRequest(testBase.defaultAdminId, 'admin')
      .post(`/api/grants/${grantId}/calculate-vesting`)
      .send({
        as_of_date: '2025-01-01' // At 12-month cliff
      })
      .expect(200);
    
    // Expected result: 12/48 * 1000 = 250.000
    const expectedVested = '250.000';
    expect(vestingResponse.body.data.vested_amount).toBe(expectedVested);
    
    // Calculate at 13 months where division isn't clean
    const partialVestingResponse = await testBase
      .getAuthenticatedRequest(testBase.defaultAdminId, 'admin')
      .post(`/api/grants/${grantId}/calculate-vesting`)
      .send({
        as_of_date: '2025-02-01' // At 13 months (one month after cliff)
      })
      .expect(200);
    
    // Expected result: 13/48 * 1000 = 270.833 which rounds to 270.833
    const expectedPartialVested = '270.833';
    expect(partialVestingResponse.body.data.vested_amount).toBe(expectedPartialVested);
  });

  /**
   * Verifies handling of maximum allowed values
   */
  it('should handle the maximum allowed values correctly', async () => {
    // Maximum value allowed: 12 digits with 3 decimal places
    const maxValue = '999999999.999';
    
    // Create pool with max value
    const pool = await testBase.createTestPool({ initial_amount: maxValue });
    
    // Attempt to create an employee and grant with max value
    const employee = await testBase.createTestEmployee();
    
    // Attempt to create a grant with max value
    const grantResponse = await testBase
      .getAuthenticatedRequest(testBase.defaultAdminId, 'admin')
      .post(testBase.grantsBasePath)
      .send({
        employee_id: employee.employee_id,
        grant_date: '2025-01-01',
        share_amount: maxValue,
        notes: 'Testing maximum value'
      });
    
    // Check either this succeeds, or if fails due to exceeding available shares
    if (grantResponse.status === 201) {
      // If it succeeds, verify the precision
      expect(grantResponse.body.data.share_amount).toBe(maxValue);
    } else {
      // If it fails due to available shares, that's expected
      expect(grantResponse.body.error.code).toBe('INSUFFICIENT_SHARES');
    }
    
    // Try creating a PPS with max value
    const ppsResponse = await testBase
      .getAuthenticatedRequest(testBase.defaultAdminId, 'admin')
      .post(testBase.ppsBasePath)
      .send({
        effective_date: '2025-01-01',
        price_per_share: maxValue,
        notes: 'Testing maximum PPS value'
      })
      .expect(201);
    
    // Verify precision is maintained
    expect(ppsResponse.body.data.price_per_share).toBe(maxValue);
  });
});
