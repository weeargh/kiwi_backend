# Kiwi3 Test Coverage Matrix

This document maps all API endpoints from our specification to their corresponding test files and identifies any coverage gaps. It also tracks validation rules and their implementation status in our test suite.

## API Endpoint Coverage

| Endpoint | Method | Description | Test File | Coverage Status | Notes |
|----------|--------|-------------|-----------|----------------|-------|
| `/health` | GET | Health check | - | ✅ Basic | Simple endpoint, covered by smoke tests |
| `/tenants` | GET | List tenants | `tenant.integration.test.js` | ✅ Complete | |
| `/tenants/{tenant_id}` | GET | Get tenant details | `tenant.integration.test.js` | ✅ Complete | |
| `/tenants/{tenant_id}` | PUT | Update tenant | `tenant.integration.test.js` | ✅ Complete | |
| `/users` | GET | List users | `user.integration.test.js` | ✅ Complete | |
| `/users` | POST | Create user | `user.integration.test.js` | ✅ Complete | |
| `/users/{user_id}` | GET | Get user details | `user.integration.test.js` | ✅ Complete | |
| `/users/{user_id}` | PUT | Update user | `user.integration.test.js` | ✅ Complete | |
| `/users/{user_id}` | DELETE | Delete user | `user.integration.test.js` | ✅ Complete | |
| `/users/me` | GET | Get current user | `user.integration.test.js` | ✅ Complete | |
| `/employees` | GET | List employees | - | ❌ Missing | Need to create employees API tests |
| `/employees` | POST | Create employee | - | ❌ Missing | Need to create employees API tests |
| `/employees/{employee_id}` | GET | Get employee | - | ❌ Missing | Need to create employees API tests |
| `/employees/{employee_id}` | PUT | Update employee | - | ❌ Missing | Need to create employees API tests |
| `/employees/{employee_id}` | DELETE | Delete employee | - | ❌ Missing | Need to create employees API tests |
| `/employees/{employee_id}/grants-summary` | GET | Get grants summary | - | ❌ Missing | Need to create employee grants tests |
| `/pools` | GET | Get pool info | `pool.integration.test.js` | ✅ Complete | |
| `/pools` | POST | Create pool | `pool.integration.test.js` | ✅ Complete | |
| `/pools/{pool_id}` | GET | Get pool details | `pool.integration.test.js` | ✅ Complete | |
| `/pools/{pool_id}/events` | GET | List pool events | `pool.integration.test.js` | ✅ Complete | |
| `/pools/{pool_id}/events` | POST | Create pool event | `pool.integration.test.js` | ✅ Complete | Also in `pool_calculations.integration.test.js` |
| `/pools/{pool_id}/events/{event_id}` | GET | Get pool event | `pool.integration.test.js` | ✅ Complete | |
| `/pps` | GET | List price history | `pps.integration.test.js` | ✅ Complete | |
| `/pps` | POST | Create price entry | `pps.integration.test.js` | ✅ Complete | Also in `decimal_precision.integration.test.js` |
| `/pps/current` | GET | Get current price | `pps.integration.test.js` | ✅ Complete | |
| `/grants` | GET | List grants | `grant.integration.test.js` | ✅ Complete | |
| `/grants` | POST | Create grant | `grant.integration.test.js` | ✅ Complete | Also in `decimal_precision.integration.test.js` |
| `/grants/{grant_id}` | GET | Get grant details | `grant.integration.test.js` | ✅ Complete | |
| `/grants/{grant_id}` | PUT | Update grant | `grant.integration.test.js` | ✅ Complete | |
| `/grants/{grant_id}/calculate-vesting` | POST | Calculate vesting | - | ❌ Missing | Now covered in `vesting_calculations.integration.test.js` |
| `/grants/bulk` | POST | Create multiple grants | - | ❌ Missing | Need to create bulk grant tests |
| `/vesting/batch-calculate` | POST | Batch calculate vesting | - | ❌ Missing | Now covered in `vesting_calculations.integration.test.js` |
| `/audit-logs` | GET | List audit logs | - | ❌ Missing | Need to create audit log tests |
| `/audit-logs/download` | GET | Download audit logs | - | ❌ Missing | Need to create audit log download tests |

## Critical Requirements Coverage

### 1. DECIMAL(12,3) Precision

| Requirement | Test File | Coverage Status | Notes |
|-------------|-----------|----------------|-------|
| Pool amounts use DECIMAL(12,3) | `decimal_precision.integration.test.js` | ✅ Complete | Tests max values, minimum precision, and overflow |
| PPS values use DECIMAL(12,3) | `decimal_precision.integration.test.js` | ✅ Complete | Tests precision maintenance in price records |
| Grant amounts use DECIMAL(12,3) | `decimal_precision.integration.test.js` | ✅ Complete | Tests precision in grant creation and updates |
| Vesting calculations preserve precision | `decimal_precision.integration.test.js` | ✅ Complete | Tests rounding and division precision |
| Arithmetic operations maintain precision | `decimal_precision.integration.test.js` | ✅ Complete | Tests addition/subtraction with precise values |

### 2. Pool Management & Calculation Rules

| Requirement | Test File | Coverage Status | Notes |
|-------------|-----------|----------------|-------|
| Total Pool = initial_amount + Σ(pool_events.amount) | `pool_calculations.integration.test.js` | ✅ Complete | Comprehensive tests for this invariant |
| Available = TotalPool - Granted + Returned | `pool_calculations.integration.test.js` | ✅ Complete | Tests with grants and terminations |
| 0 ≤ Available ≤ TotalPool must always hold | `pool_calculations.integration.test.js` | ✅ Complete | Tests boundary conditions and constraints |
| Reject grant if Available < share_amount | `pool_calculations.integration.test.js` | ✅ Complete | Tests insufficient shares scenario |
| Reject pool reduction if it would make Available < 0 | `pool_calculations.integration.test.js` | ✅ Complete | Tests excessive reduction scenario |
| Immutable PoolEvent audit trail | `pool_calculations.integration.test.js` | ✅ Complete | Tests immutability of historical events |

### 3. Price Per Share (PPS) Management

| Requirement | Test File | Coverage Status | Notes |
|-------------|-----------|----------------|-------|
| Duplicate dates with latest created_at winning | `pps.integration.test.js` | ❌ Missing | Need test for duplicate effective dates |
| price_per_share > 0 validation | `pps.integration.test.js` | ❌ Missing | Need test for negative/zero PPS |
| PPS lookup algorithm for historical prices | `pps.integration.test.js` | ✅ Complete | Current implementation tests this |

### 4. Vesting Calculation Rules

| Requirement | Test File | Coverage Status | Notes |
|-------------|-----------|----------------|-------|
| 12-month cliff, 48-month total vesting | `vesting_calculations.integration.test.js` | ✅ Complete | Tests cliff behavior and 48-month cap |
| Month-end rule for vesting dates | `vesting_calculations.integration.test.js` | ✅ Complete | Tests month boundary cases |
| Leap year handling | `vesting_calculations.integration.test.js` | ✅ Complete | Tests Feb 29 case |
| Partial month calculations | `vesting_calculations.integration.test.js` | ✅ Complete | Tests partial month vesting |
| Termination impact on vesting | `vesting_calculations.integration.test.js` | ✅ Complete | Tests vesting freeze at termination |
| Batch vesting calculations | `vesting_calculations.integration.test.js` | ✅ Complete | Tests multiple grants in one call |

### 5. Authentication & Authorization

| Requirement | Test File | Coverage Status | Notes |
|-------------|-----------|----------------|-------|
| JWT validation (Auth0) | `auth.test.js` | ✅ Complete | Tests Auth0 integration |
| Role-based access (admin vs employee) | `auth.test.js` | ✅ Complete | Tests role-based permissions |
| Tenant isolation | Various tests | ❌ Partial | Need explicit cross-tenant tests |

## Validation Rules Coverage

| Entity | Validation Rule | Test File | Coverage Status |
|--------|----------------|-----------|----------------|
| Pool | initial_amount > 0 | `pool.integration.test.js` | ✅ Complete |
| Pool | initial_amount has precision DECIMAL(12,3) | `decimal_precision.integration.test.js` | ✅ Complete |
| Pool Event | amount > 0 | `pool.integration.test.js` | ✅ Complete |
| Pool Event | amount has precision DECIMAL(12,3) | `decimal_precision.integration.test.js` | ✅ Complete |
| Pool Event | event_type in (initial, top_up, reduction) | `pool.integration.test.js` | ✅ Complete |
| PPS | price_per_share > 0 | `pps.integration.test.js` | ❌ Missing |
| PPS | price_per_share has precision DECIMAL(12,3) | `decimal_precision.integration.test.js` | ✅ Complete |
| Grant | share_amount > 0 | `grant.integration.test.js` | ✅ Complete |
| Grant | share_amount has precision DECIMAL(12,3) | `decimal_precision.integration.test.js` | ✅ Complete |
| Grant | Available shares >= share_amount | `pool_calculations.integration.test.js` | ✅ Complete |
| Grant | status transition limits | `grant.integration.test.js` | ❌ Missing |

## Coverage Gaps and Remediation Plan

1. **Employee API Tests**
   - Create comprehensive tests for employee CRUD operations
   - Implement employee grants summary tests

2. **Additional Vesting Tests**
   - Edge cases for partial month calculations
   - More complex termination scenarios

3. **Audit Log Tests**
   - Create tests for audit log generation
   - Test audit log filtering and downloads

4. **Missing Validation Rules**
   - Add tests for PPS > 0 validation
   - Add tests for duplicate effective dates in PPS

5. **Bulk Operations**
   - Create tests for bulk grant creation
   - Test validation in bulk operations

## Next Steps

1. Implement the identified missing tests, prioritizing:
   - Employee API tests
   - PPS validation rules tests
   - Grant status transition tests

2. Add additional edge case tests for critical business logic:
   - Complex vesting scenarios
   - Multi-tenant data isolation

3. Create E2E tests for critical user flows:
   - Complete grant lifecycle (creation to termination)
   - Pool management workflow
   - Employee portal views
