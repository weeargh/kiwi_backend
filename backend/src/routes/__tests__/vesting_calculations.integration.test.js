/**
 * Integration tests for Vesting Calculation Accuracy
 * Verifies the vesting calculation rules from Section 2.4 of the specification:
 * - 12-month cliff, 48-month total vesting
 * - Month-end rule for vesting dates
 * - Partial month calculation rules
 * - Termination impact on vesting
 */
const IntegrationTestBase = require('../../__tests__/integration-test-base');
const { v4: uuidv4 } = require('uuid');

class VestingCalculationTest extends IntegrationTestBase {
  constructor() {
    super();
    this.grantsBasePath = '/api/grants';
    this.calculateVestingPath = (grantId) => `/api/grants/${grantId}/calculate-vesting`;
    this.batchCalculatePath = '/api/vesting/batch-calculate';
  }

  /**
   * Helper to create a test grant with specific parameters
   */
  async createSpecificGrant(employeeId, grantDate, shareAmount, status = 'active') {
    const grantData = {
      employee_id: employeeId,
      grant_date: grantDate,
      share_amount: shareAmount,
      notes: 'Test grant for vesting calculation',
      status: status
    };

    const res = await this
      .getAuthenticatedRequest(this.defaultAdminId, 'admin')
      .post(this.grantsBasePath)
      .send(grantData)
      .expect(201);
    
    return res.body.data;
  }

  /**
   * Helper to calculate vesting for a grant as of a specific date
   */
  async calculateVesting(grantId, asOfDate) {
    const res = await this
      .getAuthenticatedRequest(this.defaultAdminId, 'admin')
      .post(this.calculateVestingPath(grantId))
      .send({ as_of_date: asOfDate })
      .expect(200);
    
    return res.body.data;
  }

  /**
   * Helper to set the system time for vesting calculations
   * This needs to be implemented at the database level since the API uses NOW()
   */
  async setTestDate(date) {
    // Format date string to timestamp
    const formattedDate = new Date(date).toISOString();
    
    // Override the current date for testing
    await this.query(`SET LOCAL TIMEZONE TO 'UTC'`);
    await this.query(`SET LOCAL TIME ZONE 'UTC'`);
    await this.query(`SET LOCAL statement_timeout TO '30s'`);
    await this.query(`SET LOCAL TIME TO '${formattedDate}'`);
  }
}

// Create test instance
const testBase = new VestingCalculationTest();

describe('Vesting Calculation Accuracy', () => {
  // Start transaction before each test for isolation
  beforeEach(async () => {
    await testBase.setup();
  });

  // Rollback transaction after each test
  afterEach(async () => {
    await testBase.teardown();
  });

  /**
   * Verifies the 12-month cliff rule
   */
  it('should apply the 12-month cliff rule correctly', async () => {
    // Create test employee
    const employee = await testBase.createTestEmployee();
    
    // Create a grant with known start date - exactly 48 shares for easy math
    const grantDate = '2024-01-15';
    const shareAmount = '48.000';
    const grant = await testBase.createSpecificGrant(
      employee.employee_id,
      grantDate,
      shareAmount
    );
    
    // Simulate vesting calculation just before cliff (11 months, 29 days)
    const beforeCliffDate = '2024-12-14';
    const beforeCliffResult = await testBase.calculateVesting(grant.grant_id, beforeCliffDate);
    
    // Verify no vesting before cliff
    expect(beforeCliffResult.vested_amount).toBe('0.000');
    expect(beforeCliffResult.vesting_events.length).toBe(0);
    
    // Simulate vesting calculation exactly at cliff (12 months)
    const atCliffDate = '2025-01-15'; 
    const atCliffResult = await testBase.calculateVesting(grant.grant_id, atCliffDate);
    
    // Verify cliff vesting - should vest 12 months worth (12/48 * 48 = 12 shares)
    expect(atCliffResult.vested_amount).toBe('12.000');
    expect(atCliffResult.vesting_events.length).toBe(1);
    expect(atCliffResult.vesting_events[0].shares_vested).toBe('12.000');
    
    // Simulate vesting calculation after cliff (18 months)
    const afterCliffDate = '2025-07-15';
    const afterCliffResult = await testBase.calculateVesting(grant.grant_id, afterCliffDate);
    
    // Verify additional vesting after cliff - should be 18/48 * 48 = 18 shares
    expect(afterCliffResult.vested_amount).toBe('18.000');
    expect(afterCliffResult.vesting_events.length).toBe(1);  // Still just the cliff event
  });

  /**
   * Verifies the month-end rule for vesting dates
   */
  it('should apply the month-end rule for vesting dates', async () => {
    // Create test employee
    const employee = await testBase.createTestEmployee();
    
    // Create a grant with end-of-month date
    const grantDate = '2024-01-31'; // January 31
    const shareAmount = '48.000';
    const grant = await testBase.createSpecificGrant(
      employee.employee_id,
      grantDate,
      shareAmount
    );
    
    // Test vesting on February 28, 2025 (Feb doesn't have 31 days but should still vest)
    // This is 13 months after grant date
    const febDate = '2025-02-28';
    const febResult = await testBase.calculateVesting(grant.grant_id, febDate);
    
    // Should vest 13 months worth (after cliff: 12 at cliff + 1 additional)
    expect(febResult.vested_amount).toBe('13.000');
    
    // Test similar case for February 29 in leap year
    // Create another grant with end-of-month date in January 2024 (leap year)
    const leapYearGrantDate = '2024-01-31';
    const leapYearGrant = await testBase.createSpecificGrant(
      employee.employee_id, 
      leapYearGrantDate,
      shareAmount
    );
    
    // Test vesting on February 29, 2024 (before cliff but testing the date logic)
    const leapDateBeforeCliff = '2024-02-29';
    await testBase.calculateVesting(leapYearGrant.grant_id, leapDateBeforeCliff);
    
    // Now test Feb 29, 2028 (next leap year, well after cliff)
    const futureLeapDate = '2028-02-29';
    const leapResult = await testBase.calculateVesting(leapYearGrant.grant_id, futureLeapDate);
    
    // Calculate expected vesting: 48+ months, but capped at 48/48 * 48 = 48 shares (fully vested)
    expect(leapResult.vested_amount).toBe('48.000');
  });

  /**
   * Verifies vesting with partial months
   */
  it('should calculate partial month vesting correctly', async () => {
    // Create test employee
    const employee = await testBase.createTestEmployee();
    
    // Create a grant with mid-month date
    const grantDate = '2024-01-15';
    const shareAmount = '48.000';
    const grant = await testBase.createSpecificGrant(
      employee.employee_id,
      grantDate,
      shareAmount
    );
    
    // Test vesting on a date with partial month - 12 months plus 10 days
    const partialMonthDate = '2025-01-25';
    const partialResult = await testBase.calculateVesting(grant.grant_id, partialMonthDate);
    
    // Should vest 12 months worth at cliff - no partial month counted yet
    expect(partialResult.vested_amount).toBe('12.000');
    
    // Test vesting on a date with partial month after the 15th
    const nextMonthDate = '2025-02-20'; // More than 1 month after cliff
    const nextResult = await testBase.calculateVesting(grant.grant_id, nextMonthDate);
    
    // Should vest 13 months worth (12 at cliff + 1 additional month)
    expect(nextResult.vested_amount).toBe('13.000');
  });

  /**
   * Verifies vesting for terminated grants
   */
  it('should correctly handle vesting for terminated grants', async () => {
    // Create test employee
    const employee = await testBase.createTestEmployee();
    
    // Create a grant
    const grantDate = '2024-01-15';
    const shareAmount = '48.000';
    const grant = await testBase.createSpecificGrant(
      employee.employee_id,
      grantDate,
      shareAmount
    );
    
    // Calculate vesting after cliff
    const afterCliffDate = '2025-01-20'; // Just after cliff
    const beforeTerminationResult = await testBase.calculateVesting(grant.grant_id, afterCliffDate);
    expect(beforeTerminationResult.vested_amount).toBe('12.000');
    
    // Terminate the grant at a specific date
    const terminationDate = '2025-01-31';
    await testBase.query(
      `UPDATE grants 
       SET status = 'inactive', 
           termination_date = $1,
           unvested_shares_returned = $2
       WHERE grant_id = $3`,
      [terminationDate, '36.000', grant.grant_id]
    );
    
    // Attempt to calculate vesting after termination date
    const afterTerminationDate = '2025-06-15'; // Well after termination
    const afterTerminationResult = await testBase.calculateVesting(
      grant.grant_id, 
      afterTerminationDate
    );
    
    // Vesting should be frozen at termination date value
    expect(afterTerminationResult.vested_amount).toBe('12.000'); // Still just cliff vesting
    expect(afterTerminationResult.is_terminated).toBe(true);
    expect(afterTerminationResult.termination_date).toBe(terminationDate);
  });

  /**
   * Verifies the 48-month maximum vesting
   */
  it('should cap vesting at 48 months (100%)', async () => {
    // Create test employee
    const employee = await testBase.createTestEmployee();
    
    // Create a grant
    const grantDate = '2024-01-15';
    const shareAmount = '48.000';
    const grant = await testBase.createSpecificGrant(
      employee.employee_id,
      grantDate,
      shareAmount
    );
    
    // Calculate vesting far in the future (beyond 48 months)
    const futureDate = '2030-01-15'; // 6 years after grant
    const futureResult = await testBase.calculateVesting(grant.grant_id, futureDate);
    
    // Should be fully vested (capped at 48 months)
    expect(futureResult.vested_amount).toBe(shareAmount); // All shares vested
    expect(futureResult.vesting_percentage).toBe('100.000'); // 100% vested
  });

  /**
   * Verifies batch vesting calculations
   */
  it('should correctly calculate batch vesting for multiple grants', async () => {
    // Create test employees
    const employee1 = await testBase.createTestEmployee();
    const employee2 = await testBase.createTestEmployee();
    
    // Create multiple grants with different dates
    const grant1 = await testBase.createSpecificGrant(
      employee1.employee_id,
      '2024-01-15', // First grant
      '48.000'
    );
    
    const grant2 = await testBase.createSpecificGrant(
      employee2.employee_id,
      '2024-03-01', // Second grant, different date
      '96.000'
    );
    
    // Calculate batch vesting for a date after both grants' cliffs
    const batchDate = '2025-04-15'; // After cliff for both
    
    const batchResult = await testBase
      .getAuthenticatedRequest(testBase.defaultAdminId, 'admin')
      .post(testBase.batchCalculatePath)
      .send({
        grant_ids: [grant1.grant_id, grant2.grant_id],
        as_of_date: batchDate
      })
      .expect(200);
    
    // Verify results for both grants
    const results = batchResult.body.data;
    expect(results.length).toBe(2);
    
    // Grant 1: 15 months after start (12 cliff + 3 additional)
    const grant1Result = results.find(g => g.grant_id === grant1.grant_id);
    expect(grant1Result.vested_amount).toBe('15.000');
    
    // Grant 2: 13 months after start (12 cliff + 1 additional)
    const grant2Result = results.find(g => g.grant_id === grant2.grant_id);
    expect(grant2Result.vested_amount).toBe('24.000'); // 13/48 * 96 = 24
  });
});
