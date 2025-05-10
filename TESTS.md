# Kiwi3 Testing Strategy and Setup

This document outlines the testing strategy, setup, and plans for the Kiwi3 RSU/ESOP platform.

## Executive Summary

The Kiwi3 platform is tested at multiple levels to ensure quality and reliability:

- **E2E Tests (Cypress)** verify complete user workflows from the frontend through the backend to the database.
- **Integration Tests (Jest/Supertest)** test API endpoints with a real test database to ensure correct data flow.
- **Unit Tests (Jest)** verify individual components and business logic in isolation.

Our testing strategy now includes critical validation tests that verify compliance with key requirements from the specification:

- **Pool Calculation Invariants Tests** verify that pool calculations follow the required formulas and constraints.
- **Vesting Calculation Accuracy Tests** ensure vesting follows the 48-month schedule with 12-month cliff and handles edge cases.
- **Decimal Precision Tests** confirm all financial values maintain DECIMAL(12,3) precision throughout operations.

Our tests use mock implementations for external dependencies like Auth0 to allow thorough testing without external dependencies. The test suite is designed to be maintainable, efficient, and to catch regressions early.

## Table of Contents

- [Overall Testing Strategy](#overall-testing-strategy)
- [Critical Specification Tests](#critical-specification-tests)
  - [Pool Calculation Invariants](#pool-calculation-invariants)
  - [Vesting Calculation Accuracy](#vesting-calculation-accuracy)
  - [Decimal Precision Handling](#decimal-precision-handling)
- [End-to-End (E2E) Tests](#end-to-end-e2e-tests)
  - [Setup](#setup)
  - [Running E2E Tests](#running-e2e-tests)
  - [Current E2E Scenarios](#current-e2e-scenarios)
- [Unit Tests](#unit-tests)
  - [Backend Unit Tests](#backend-unit-tests)
  - [Frontend Unit Tests](#frontend-unit-tests)
- [Integration Tests](#integration-tests)
  - [Backend Integration Tests](#backend-integration-tests)
  - [Auth0 Authentication Mocking](#auth0-authentication-mocking)
  - [Writing New Integration Tests](#writing-new-integration-tests)
- [Test Coverage Matrix](#test-coverage-matrix)
- [CI/CD Integration](#cicd-integration)
- [Test File Structure](#test-file-structure)
- [Known Issues and Troubleshooting](#known-issues-and-troubleshooting)

## Overall Testing Strategy

Our goal is to have a comprehensive test suite that covers various levels of the application to ensure reliability, correctness, and maintainability. This includes E2E tests for user flows, integration tests for service interactions, and unit tests for individual components and functions.

### Best Practices Implemented

We follow these key best practices across all tests:

1. **Separate Test Environments**: We use different databases for development, unit testing, integration testing, and E2E testing to prevent test interference.

2. **Mock External Services**: Auth0 and other third-party services are fully mocked to eliminate external dependencies during testing.

3. **Transaction Isolation**: Integration tests use database transactions to ensure each test is isolated from others. Changes made during a test are rolled back afterward.

4. **Consistent Test Data**: We've created test helpers that provide consistent test fixtures across test runs.

5. **Test Independence**: Each test is completely independent and doesn't rely on state from other tests.

6. **Specification Alignment**: Our tests verify compliance with business requirements outlined in the specification documents.

7. **Comprehensive Coverage**: Our test suite is designed to cover all critical system components, business logic, and edge cases.

This strategy ensures our tests are reliable, fast, and maintainable as the application grows.

## Critical Specification Tests

We have implemented specialized integration tests to verify compliance with key requirements from the specification document.

### Pool Calculation Invariants

The pool calculation tests (`pool_calculations.integration.test.js`) verify that the system correctly maintains these critical invariants:

1. **Total Pool Formula**: Total Pool = initial_amount + Σ(pool_events.amount)
2. **Available Shares Formula**: Available = TotalPool - Granted + Returned 
3. **Available Constraint**: 0 ≤ Available ≤ TotalPool must always hold

Key tests include:

- Verification of total pool calculations through multiple events (top-up, reduction)
- Verification of available shares when grants are created and terminated
- Confirmation that grants are rejected when available shares are insufficient
- Verification that pool reductions are rejected if they would make Available < 0
- Confirmation that pool events are immutable once created

These tests are critical to ensure data integrity and prevent invalid financial states in the system.

### Vesting Calculation Accuracy

The vesting calculation tests (`vesting_calculations.integration.test.js`) verify that the vesting engine correctly implements the vesting schedule rules:

1. **Schedule Rules**: 12-month cliff, 48-month total vesting
2. **Month-End Rule**: For grants on the 29th, 30th, or 31st of a month, vesting in shorter months occurs on the last day of the month
3. **Partial Month Rule**: Partial months are rounded to nearest whole month

Key tests include:

- Verification of the 12-month cliff (no vesting before cliff, correct vesting at cliff)
- Verification of month-end rule handling (including leap years)
- Calculation of partial month vesting
- Confirmation that vesting stops at termination
- Verification of the 48-month vesting cap
- Testing of batch vesting calculations

These tests ensure accurate financial calculations for equity grants.

### Decimal Precision Handling

The decimal precision tests (`decimal_precision.integration.test.js`) verify that all financial values maintain DECIMAL(12,3) precision as required:

Key tests include:

- Verification of maximum precision values (999999999.999)
- Verification of minimum precision values (0.001)
- Rejection of sub-minimum precision values (0.0001)
- Maintenance of precision in price per share values
- Preservation of precision through arithmetic operations
- Verification of precision in vesting calculations (including rounding)

These tests ensure financial accuracy and consistent decimal handling throughout the system.

## End-to-End (E2E) Tests

E2E tests simulate real user scenarios from the frontend through the backend to the database. Our implementation includes comprehensive Auth0 mocking and a specialized test environment to ensure reliable, repeatable tests.

### Setup

- **Framework:** [Cypress](https://www.cypress.io/)
- **Application Environment:** The application uses a dedicated E2E testing environment with separate containers orchestrated by `docker-compose.cypress.yml`.
- **Cypress Configuration:**
  - Main config: `frontend/cypress.config.js`
  - `baseUrl` is set to `http://localhost:8081` for the E2E test environment
  - Environment variables configure the API URL and Auth0 settings
- **Test Location:** `frontend/cypress/e2e/`
- **Cypress Dashboard:** Test runs can be recorded to the Cypress Dashboard for analysis and history. The `projectId` is configured in `frontend/cypress.config.js`.

### Auth0 Authentication Mocking

We've implemented a custom Cypress command to mock Auth0 authentication without requiring real Auth0 credentials:

```javascript
Cypress.Commands.add('mockAuth0Login', (role = 'admin') => {
  // Define tenant and user information
  const tenantId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
  const mockUserId = role === 'admin' ? 'auth0|admin-test-123' : 'auth0|employee-test-123';
  
  // Set up localStorage with mock tokens and user profile
  window.localStorage.setItem('auth0.is.authenticated', 'true');
  window.localStorage.setItem('auth0.access_token', fakeAccessToken);
  window.localStorage.setItem('auth0.user', JSON.stringify(user));
  
  // Seed the test user in the database via API
  return cy.request({
    method: 'POST',
    url: Cypress.env('apiUrl') || 'http://localhost:3001',
    body: {
      auth0_id: mockUserId,
      tenant_id: tenantId,
      email: mockUserEmail,
      name: mockUserName,
      role: role
    }
  });
});
```

This approach allows us to test authenticated flows without the complexity and flakiness of real Auth0 authentication.

### Test Data Management

We've created backend API endpoints specifically for E2E testing to reset the database state and seed test data:

```javascript
// Only enabled in test environments
router.post('/reset-db', async (req, res) => {
  // Truncate all tables and reseed with baseline test data
});

router.post('/seed-user', async (req, res) => {
  // Create or update a user for testing
});

router.post('/seed-pool-events', async (req, res) => {
  // Create multiple pool events for testing pagination
});
```

These endpoints allow tests to start with a clean, known data state for consistent results.

### Running E2E Tests

1.  **Start the dedicated E2E test environment:**
    ```bash
    docker-compose -f docker-compose.cypress.yml up -d
    ```
    This starts a separate test database, backend and frontend specifically for E2E testing.

2.  **Open Cypress Test Runner (Interactive Mode):**
    Navigate to the `frontend` directory and run:
    ```bash
    cd frontend
    npx cypress open
    ```
    Then select a browser and click on a spec file to run it. This mode is ideal for writing and debugging tests.

3.  **Run Cypress Tests Headlessly (CLI Mode):**
    Navigate to the `frontend` directory and run:
    ```bash
    cd frontend
    npx cypress run
    ```
    To record results to Cypress Dashboard (ensure `projectId` in `cypress.config.js` and your record key are correctly set up):
    ```bash
    npx cypress run --record --key YOUR_CYPRESS_RECORD_KEY
    ```
    This mode is suitable for CI/CD pipelines.
    
4.  **Tear down the test environment when finished:**
    ```bash
    docker-compose -f docker-compose.cypress.yml down
    ```

### Current E2E Scenarios (Initial Set)

*   **T_E2E_001: Application Load (Smoke Test)**
    *   **Status:** Implemented (`frontend/cypress/e2e/smoke.cy.js`)
    *   **Objective:** Verify the frontend application loads successfully.
    *   **Steps:**
        1.  Visit the `baseUrl` (`http://localhost:8080`).
    *   **Expected Result:** The main application page/shell renders, and initial content ("Kiwi3 RSU Platform", "Please log in to access the platform.") is visible.

*   **T_E2E_002: Post-Login Tenant Information Display**
    *   **Status:** On Hold / Needs Auth0 login refinement
    *   **Objective:** Verify that after a user is authenticated, the application displays information related to the default tenant.
    *   **Note:** Testing the full Auth0 login flow can be complex. Initial tests might require mocking the authenticated state or using Cypress commands like `cy.origin()` to handle cross-origin redirects if Auth0 login is attempted directly. For simplicity, an initial version might focus on testing post-authentication by programmatically setting session state if feasible.
    *   **Steps:**
        1.  Ensure the user is authenticated and associated with the default tenant (`tenant_id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'`).
        2.  Navigate to a page that is expected to display tenant-specific information (e.g., a dashboard header, settings page).
    *   **Expected Result:** The tenant name "Testt Co" (or other relevant tenant-specific data seeded in the migration) is visible on the page.

*   **T_E2E_003: User Account Sync on First Login (Visibility in UI)**
    *   **Status:** On Hold / Needs Auth0 login refinement
    *   **Objective:** Verify that when a new Auth0 user (correctly configured with the default tenant ID in their token) logs into the application for the first time, their user information is displayed, indicating a successful backend sync to `user_accounts`.
    *   **Note:** Requires a *new* Auth0 test user for each run or a programmatic way to clear their corresponding `user_accounts` record before the test while keeping the Auth0 user intact.
    *   **Steps:**
        1.  Log in with an Auth0 user (who hasn't been synced to the `user_accounts` table for this tenant before) whose token contains `tenant_id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'`.
        2.  Navigate to a user profile page or an area that displays the logged-in user's name or email as obtained from the Auth0 token.
    *   **Expected Result:** The new user's name and/or email are displayed correctly, matching the information from their Auth0 profile.

---

## Unit Tests

Unit tests focus on isolating and testing the smallest parts of the application, such as individual functions, methods, or components. Our implementation ensures tests are isolated and use proper mocking techniques.

### Backend Unit Tests (Node.js/Express)

- **Primary Tooling:** Jest (already a dev dependency in `backend/package.json`). Alternatives include Mocha/Chai.
- **Key Areas to Target:**
  - **Middleware:** Critical middleware like `backend/src/middleware/auth.js` (specifically the `syncUser` logic). We implemented comprehensive mocks for database interactions (`pg Pool`) and `req.auth.payload` from Auth0.
  - **Utility Functions:** Any helper functions or modules within `backend/src/utils/`.
  - **Route Handler Logic:** Test the core logic of individual route handlers from `backend/src/routes/` by mocking `req`, `res`, and any service/database calls they make.
  - **Database Access Logic:** If you have abstracted database queries into specific modules or services, unit test this logic by mocking the database driver/client responses.

#### Test Isolation and Database Mocking

For unit tests, we fully mock the database layer to ensure true isolation:

```javascript
// Example from auth.test.js
jest.mock('../config/db', () => ({
  pool: {
    query: jest.fn()
  }
}));

const { pool } = require('../config/db');

// Inside the test
pool.query.mockResolvedValueOnce({ rows: [] });
```

This approach ensures unit tests never hit a real database and run quickly and consistently.

### Frontend Unit Tests (Vue.js)

- **Primary Tooling:** Vitest (integrates well with Vite) or Jest with `@vue/test-utils`.
- **Key Areas to Target:**
  - **Vue Components:** Individual components in `frontend/src/components/`. Test props, emitted events, slots, computed properties, methods, and internal state changes.
  - **Composable Functions:** If using Vue 3's Composition API for reusable logic.
  - **State Management:** If using a state management library (e.g., Pinia or Vuex), test actions, mutations, and getters.
  - **Service/Utility Functions:** Any frontend helper functions, API service wrappers in `frontend/src/services/`, etc.

## Integration Tests

Integration tests verify the interactions between different parts of the system. Our implementation ensures proper test isolation through transaction-based testing and separate test environments.

### Backend Integration Tests

Integration tests for the backend API endpoints verify that the entire request-response cycle functions correctly, from URL routing through middleware (including authentication), to database interaction and back.

### Setup & Organization

- **Location:** `backend/src/routes/__tests__/*.integration.test.js`
- **Database:** Uses a separate test database (`uniquedb456_test` by default, or as specified by `DB_NAME_TEST` in `.env`).
- **Authentication:** Authentication middleware is mocked to simulate both successful and failed authentication scenarios.
- **Mocks:** The Auth0 authentication middleware is mocked in `backend/src/middleware/__mocks__/auth.js`.
- **Utilities:** Common testing utilities are centralized in `backend/src/__tests__/test-utils.js` and `backend/src/__tests__/db-test-helper.js`.

### Transaction-based Test Isolation

We've implemented a transaction-based approach for test isolation using our `DbTestHelper` class:

```javascript
class DbTestHelper {
  // Start a transaction for test isolation
  async startTransaction() {
    this.client = await this.pool.connect();
    await this.client.query('BEGIN');
    this.transactionActive = true;
    return this.client;
  }

  // Rollback the transaction to isolate tests
  async rollbackTransaction() {
    if (this.transactionActive && this.client) {
      await this.client.query('ROLLBACK');
      this.client.release();
      this.transactionActive = false;
    }
  }
}
```

This approach ensures that each test works with real database operations but without persisting changes between tests, giving us true isolation without test interference.

### Integration Test Base Helper

We've created an `IntegrationTestBase` class that provides:

1. **Transaction Management**: Automatically starts and rolls back transactions
2. **Authentication Mocking**: Easily mock different user roles and permissions
3. **Test Data Helpers**: Methods to create consistent test fixtures
4. **Isolated Queries**: Database operations that respect the current transaction

```javascript
class IntegrationTestBase {
  async setup() {
    await this.dbHelper.startTransaction();
  }
  
  async cleanup() {
    await this.dbHelper.rollbackTransaction();
  }
  
  getAuthenticatedRequest(userId, role, tenantId) {
    this.mockAuthMiddleware(userId, role, tenantId);
    return request(app);
  }
}
```

Using this base class significantly simplifies writing isolated, reliable integration tests.

### Test Database Setup

The integration tests require a separate test database (`kiwi3_test` by default) with the same schema as the development database but isolated data. To set up this database:

1. Ensure your `.env` file includes `DB_NAME_TEST=kiwi3_test` (or your preferred test DB name).
2. The database is created and migrations are applied using:
   ```bash
   # From project root
   docker-compose run --rm migrate
   ```

This test database contains seed data, including a default tenant with ID `f47ac10b-58cc-4372-a567-0e02b2c3d479` and name "Testt Co".

### Running Integration Tests

To run all backend tests:
```bash
cd backend
npm test
```

To run a specific integration test file:
```bash
cd backend
npm test -- routes/__tests__/tenant.integration.test.js
```

To run tests with coverage reporting:
```bash
cd backend
npm test -- --coverage
```

### Auth0 Authentication Mocking

The integration tests use a custom mocking approach for Auth0 authentication:

1. **Middleware Mocking:** The tests mock the `auth.js` middleware using Jest's module mocking system. This is done with `jest.mock('../../middleware/auth')` at the top of each test file.

2. **Mock Implementation:** The mock implementation in `backend/src/middleware/__mocks__/auth.js` provides:
   - `checkJwt`: Simulates JWT validation by setting `req.auth.payload` with appropriate claims
   - `syncUser`: Simulates user lookup and sync by setting `req.user` with tenant information
   - `authorizeRole`: Simulates role-based authorization checks
   
3. **Helper Functions:** The mock provides these functions:
   - `resetToSuccess()`: Resets the mock to a successful authentication state
   - `simulateAuthFailure()`: Configures the mock to simulate authentication failure

### Writing New Integration Tests

1. **Create a new test file:** Name it with the `.integration.test.js` suffix for clarity.

2. **Mock the auth middleware:** Include this at the top of your test file:
   ```javascript
   jest.mock('../../middleware/auth');
   const { checkJwt, syncUser, authorizeRole } = require('../../middleware/auth');
   ```

3. **Setup before each test:** Reset the auth mock before each test:
   ```javascript
   beforeEach(() => {
     checkJwt.resetToSuccess();
   });
   ```

4. **Simulate authentication failure:** When testing auth failure scenarios:
   ```javascript
   checkJwt.simulateAuthFailure();
   ```

5. **Use test utilities:** Import helper functions for consistent test data:
   ```javascript
   const { validateTenantStructure, MOCK_TENANT_ID } = require('../../__tests__/test-utils');
   ```

Example test structure:
```javascript
const request = require('supertest');
const app = require('../../index');
const { validateTenantStructure, MOCK_TENANT_ID } = require('../../__tests__/test-utils');

jest.mock('../../middleware/auth');
const { checkJwt } = require('../../middleware/auth');

describe('Your API - Integration Tests', () => {
  beforeEach(() => {
    checkJwt.resetToSuccess();
  });

  it('should handle authenticated requests', async () => {
    const response = await request(app)
      .get('/your-endpoint')
      .set('Authorization', 'Bearer mock-token')
      .expect(200);
    
    expect(response.body.success).toBe(true);
  });
  
  it('should reject unauthenticated requests', async () => {
    checkJwt.simulateAuthFailure();
    
    const response = await request(app)
      .get('/your-endpoint')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
    
    expect(response.body.success).toBe(false);
  });
  
  afterAll(async () => {
    // Close database connection
    await app.locals.pool.end();
  });
});

## CI/CD Integration

The test suite is integrated into our development workflow as follows:

1. **Pre-commit**: Developers are encouraged to run relevant tests locally before committing code:
   ```bash
   # For backend changes
   cd backend && npm test
   # For frontend changes that affect E2E scenarios
   cd frontend && npx cypress run
   ```

2. **Pull Requests**: When a PR is opened, a CI workflow automatically:
   - Lints the code for style issues
   - Runs backend unit and integration tests
   - Runs a subset of critical E2E tests

3. **Main Branch**: When code is merged to main, the CI workflow:
   - Runs the complete test suite
   - Generates coverage reports
   - Deploys to the staging environment if all tests pass

## Test File Structure

- **Backend Unit/Integration Tests:**
  - Conventionally placed in a `__tests__` subdirectory near the code being tested (e.g., `backend/src/middleware/__tests__/auth.test.js`).
  - Or using a `.test.js` or `.spec.js` suffix (e.g., `backend/src/utils/helpers.test.js`).
  - Integration tests use the naming pattern `.integration.test.js` for clarity.
- **Frontend Unit Tests:**
  - Similarly, in a `__tests__` subdirectory or with a `.spec.js` suffix (e.g., `frontend/src/components/__tests__/MyComponent.spec.js`).
- **E2E Tests:**
  - Located in `frontend/cypress/e2e/` as per Cypress conventions (e.g., `frontend/cypress/e2e/login.cy.js`).

## Known Issues and Troubleshooting

### Test Database Connection Issues

**Issue**: When running backend integration tests, you might encounter database connection errors.

**Solution**:
1. Ensure the test database exists and migrations have been applied:
   ```bash
   docker-compose run --rm migrate
   ```
2. Verify that your `.env` file has the correct test database credentials:
   ```
   DB_NAME_TEST=kiwi3_test
   DB_USER=uniqueuser123
   DB_PASSWORD=password
   DB_HOST=localhost
   DB_PORT=5432
   ```
3. If connecting from within Docker, use `DB_HOST=postgres` instead of `localhost`.

### Jest Not Exiting After Tests

**Issue**: Jest may hang after tests complete, especially with database connections.

**Solution**:
- The `npm test` script in `backend/package.json` already includes the `--forceExit` flag.
- If running a custom Jest command, add `--forceExit` or `--detectOpenHandles` to identify what's keeping Jest alive.

### Auth0 Mocking Issues

**Issue**: Tests involving authentication may fail if the Auth0 mocking is not properly set up.

**Solution**:
1. Verify you're mocking the auth middleware correctly in your tests:
   ```javascript
   jest.mock('../../middleware/auth');
   const { checkJwt } = require('../../middleware/auth');
   ```

2. In your test setup, ensure you reset the mock to a successful state:
   ```javascript
   beforeEach(() => {
     checkJwt.resetToSuccess();
   });
   ```

3. For tests that should simulate authentication failure:
   ```javascript
   checkJwt.simulateAuthFailure();
   ```

### Cypress Auth0 Login Testing

**Issue**: Testing Auth0 login with Cypress can be challenging due to cross-origin redirects.

**Solution**:
- See the placeholder in `frontend/cypress/e2e/auth.cy.js` for the recommended approach.
- Consider using Auth0's [Testing Guide](https://auth0.com/docs/secure/tokens/access-tokens/validate-access-tokens) for best practices.

### Test Coverage Matrix

We've created a comprehensive test coverage matrix that maps all API endpoints from our specification to their corresponding test files and identifies any coverage gaps.

The matrix is maintained in `TEST_COVERAGE_MATRIX.md` and includes:

- API endpoint coverage status
- Critical requirements coverage
- Validation rules coverage
- Identified gaps and remediation plans

This matrix helps ensure we're testing all aspects of the specification and provides visibility into areas that need additional testing. It also serves as documentation for the alignment between our tests and the system requirements.