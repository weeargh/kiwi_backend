# RSU/ESOP Platform Specification
**Version**: 1.0 (Core MVP)

**Last Updated**: May 8, 2025
> *Full canonical specification—functional‑risk and data‑integrity gaps closed: unified enums, positive‑only PoolEvents, created_by everywhere, NOT NULL defaults, uniform DECIMAL(12,3), partial‑unique indexes, ISO currency code only.*

## Table of Contents
1. [Overview](#1-overview)
2. [Functional Requirements](#2-functional-requirements)
3. [Data Model](#3-data-model)
4. [Key Business Logic & Rules](#4-key-business-logic--rules)
5. [API Overview](#5-api-overview)
6. [Security & Operations](#6-security--operations)
7. [Technical Architecture](#7-technical-architecture)
8. [UX Principles](#8-ux-principles)
9. [Naming & Consistency Guide](#9-naming--consistency-guide)
10. [Implementation Timeline](#10-implementation-timeline)
11. [Success Metrics](#11-success-metrics)
12. [Integration Test Scenario](#12-integration-test-scenario)
13. [System Initialization](#13-system-initialization)
14. [Change Log](#14-change-log)

---

## 1. Overview

### 1.1 Purpose
Deliver a lean, audit‑ready RSU/ESOP platform that lets startups manage equity with minimal overhead.

### 1.2 Core Value Proposition
> "Equity management that feels like compensation — not compliance."

### 1.3 Scope (v1.0 Core MVP)
- Single ordinary‑share class.
- **DECIMAL(12,3) precision** for all share & monetary fields.
- Vesting schedule: 12‑month cliff, 48 months total.
- Roles: Admin, Employee.
- Equity pool & PPS management, vesting engine, daily batch.
- Soft delete on all tables.
- ISO currency code only (symbol handled in UI map).
- Basic, timezone‑aware web UI.

### 1.4 Core Definitions

| Term | Definition |
| --- | --- |
| **Tenant** | Company workspace (settings, pool, users, employees). |
| **RSU** | Right to one share when vested. |
| **Grant** | RSU award with schedule. |
| **Cliff** | First 12 months with no accessible shares. |
| **Vesting Schedule** | Monthly vesting over 48 months. |
| **PPS** | Tenant‑set price per share. |
| **Returned** | Unvested RSUs cancelled at termination. |
| **Available** | `TotalPool – Granted + Returned`. |

---

## 2. Functional Requirements

### 2.1 Pool Management

#### 2.1.1 Metrics
- **TotalPool** = `initial_amount + Σ(pool_events.amount)`
- **Granted** = Σ(**active status grants.share_amount**)
- **Returned** = Σ(grants.unvested_shares_returned WHERE status = 'inactive')
- **Available** = `TotalPool – Granted + Returned`

#### 2.1.2 Rules
- Keep `0 ≤ Available ≤ TotalPool` always.
- `PoolEvent.amount` is signed: positive for top_up, negative for reduction.
- No CHECK constraint on sign; amount directly represents the effect on the pool.
- Immutable PoolEvent audit trail.

### 2.2 PPS Management
- `PPSHistory` rows keyed on `effective_date`. Duplicate dates allowed; latest `created_at` wins.
- Index `(tenant_id, effective_date, created_at DESC)` for efficient PPS lookup.
- `price_per_share` DECIMAL(12,3) NOT NULL > 0.
- Current PPS lookup query:
  ```sql
  SELECT * FROM pps_history 
  WHERE tenant_id = ? AND effective_date <= CURRENT_DATE 
  ORDER BY effective_date DESC, created_at DESC 
  LIMIT 1
  ```

### 2.3 Grant Management
- Reject if `Available < share_amount`.
- Status transitions: `active` → `inactive`.

### 2.4 Vesting Engine
- **Tranche size** = `share_amount / 48` → rounded to 3 dp using **Round half to even (Banker's Rounding)** method.
- **Cliff unlock** at month 13.
- **Month‑end rule**: `vest_date = min(original_day, days_in_month(target_month))`.
  
  *e.g.* grant on **31 Jan 2025** → vest dates: 29 Feb 2025 (leap), 31 Mar, 30 Apr, ….
  
- **Leap‑year rule**: grants on Feb 29 vest on Feb 29 during leap years, Feb 28 otherwise.
- **Final tranche** adjusts for rounding (see Section 4.1).
- **Processing scope**: Vesting engine only processes grants with status = 'active'.
- **Synchronization**: `Grant.vested_amount` must always equal the sum of `shares_vested` from associated `VestingEvent` records. Creating or modifying a `VestingEvent` must atomically update the corresponding `Grant.vested_amount` within the same transaction.
- **API Calculation**: The `POST /grants/{id}/calculate-vesting` endpoint triggers vesting calculation. It is **idempotent**: it only calculates and creates *new* `VestingEvent` records for vesting periods that have passed (relative to the current date in the tenant's timezone) since the last calculation for that grant. It does not recalculate existing events.
- **Daily Job**: Exposed via API + daily job (02:00 tenant TZ).
    - **Job Scope**: The daily batch job identifies grants for processing by selecting all grants with `status = 'active'` where the grant's next potential vesting date (calculated based on `grant_date` and the 48-month schedule) is on or before the current date determined *individually for each tenant based on their timezone*, and for which a corresponding `VestingEvent` does not yet exist.
    - **Job Concurrency**: Implementations must prevent race conditions between the API endpoint and the batch job attempting to vest the same grant simultaneously. This should be handled using optimistic locking (`Grant.version` checks) or pessimistic database row-level locking during the vesting calculation and update process.

### 2.5 Employee Portal
- Display numbers with 3 dp.
- "Not tax advice" disclaimer.
- Responsive tables.

### 2.6 Termination Workflow
- `unvested_shares_returned = share_amount – vested_amount` (3 dp). Calculation is based on the `Grant.vested_amount` *as it exists at the time of termination*, reflecting only fully completed past vesting events. No partial/pro-rata vesting is calculated for the period between the last vest date and the termination date.
- Same‑day termination returns all shares.
- Transaction must use `sp_adjust_pool()` (SERIALIZABLE).
- API: `POST /grants/{id}/terminate` with `termination_date` (interpreted in tenant timezone), `reason`, `notes`.
- Termination data is stored directly in the Grant table rather than in a separate Termination table.
- Status changes from `active` to `inactive` when terminated.

### 2.7 Import Functionality
Deferred to v1.1.

### 2.8 Authorization Framework
- JWT (24 h), cookies for SPA; password policy ≥8 chars + complexity (≥1 upper, ≥1 lower, ≥1 digit).
- Middleware enforces `admin` vs. `employee` scopes.

---

## 3. Data Model

### 3.1 Conventions
- Snake_case names.
- DECIMAL(12,3) everywhere.
- created_at NOT NULL, deleted_at NULLABLE.
- created_by UUID FK in every user‑initiated table.
- Partial unique indexes exclude soft‑deleted rows.

### 3.2 Entity Schemas (key fields)

The following schema includes recommended indexes for optimized queries:

```sql
-- For employee-based grant lookups
CREATE INDEX idx_grants_employee_id ON grants(employee_id, status) WHERE deleted_at IS NULL;

-- For efficient filtering of active/inactive grants
CREATE INDEX idx_grants_status ON grants(tenant_id, status) WHERE deleted_at IS NULL;

-- For date-range vesting queries (common for reports)
CREATE INDEX idx_vesting_events_date ON vesting_events(tenant_id, vest_date);

-- For efficient audit log filtering
CREATE INDEX idx_audit_logs_entity ON audit_logs(tenant_id, entity_type, entity_id);
CREATE INDEX idx_audit_logs_date ON audit_logs(tenant_id, created_at);

-- For PPS history efficient lookup
CREATE INDEX idx_pps_lookup ON pps_history(tenant_id, effective_date, created_at DESC);
```

#### Tenant
| Field | Type | Notes |
| --- | --- | --- |
| tenant_id | UUID | PK |
| name | VARCHAR(100) | required |
| currency | CHAR(3) | ISO-4217 |
| timezone | VARCHAR(50) | IANA ID |
| created_at | TIMESTAMP | UTC |
| deleted_at | TIMESTAMP | nullable |

#### UserAccount
| Field | Type | Notes |
| --- | --- | --- |
| user_id | UUID | PK |
| tenant_id | UUID | FK → Tenant |
| email | VARCHAR(255) | unique* per tenant |
| name | VARCHAR(100) |  |
| role | ENUM('admin','employee') |  |
| status | ENUM('active','inactive') |  |
| password_hash | TEXT | bcrypt |
| created_at | TIMESTAMP |  |
| deleted_at | TIMESTAMP |  |

#### Employee
| Field | Type | Notes |
| --- | --- | --- |
| employee_id | UUID | PK |
| tenant_id | UUID | FK |
| email | VARCHAR(255) | unique* per tenant |
| first_name | VARCHAR(50) |  |
| last_name | VARCHAR(50) |  |
| status | ENUM('active','inactive') |  |
| created_at | TIMESTAMP |  |
| deleted_at | TIMESTAMP |  |

#### EquityPool
| Field | Type | Notes |
| --- | --- | --- |
| pool_id | UUID | PK |
| tenant_id | UUID | FK |
| initial_amount | DECIMAL(12,3) | >0 |
| total_pool | DECIMAL(12,3) | ≥0 |
| created_by | UUID | FK → UserAccount |
| created_at | TIMESTAMP |  |
| deleted_at | TIMESTAMP |  |

#### PoolEvent
| Field | Type | Notes |
| --- | --- | --- |
| event_id | UUID | PK |
| pool_id | UUID | FK |
| tenant_id | UUID | FK |
| amount | DECIMAL(12,3) | signed: positive for top_up, negative for reduction |
| event_type | ENUM('initial','top_up','reduction') |  |
| effective_date | DATE |  |
| notes | TEXT | nullable |
| created_by | UUID | FK → UserAccount |
| created_at | TIMESTAMP |  |

#### PPSHistory
| Field | Type | Notes |
| --- | --- | --- |
| pps_id | UUID | PK |
| tenant_id | UUID | FK |
| effective_date | DATE |  |
| price_per_share | DECIMAL(12,3) | >0 |
| created_by | UUID | FK → UserAccount |
| created_at | TIMESTAMP |  |
| deleted_at | TIMESTAMP |  |

#### Grant
| Field | Type | Notes |
| --- | --- | --- |
| grant_id | UUID | PK |
| tenant_id | UUID | FK |
| employee_id | UUID | FK |
| grant_date | DATE |  |
| share_amount | DECIMAL(12,3) | NOT NULL >0 |
| vested_amount | DECIMAL(12,3) | NOT NULL DEFAULT 0.000 |
| status | ENUM('active','inactive') |  |
| termination_date | DATE | nullable |
| unvested_shares_returned | DECIMAL(12,3) | DEFAULT 0.000 |
| termination_reason | TEXT | nullable |
| terminated_by | UUID | FK → UserAccount, nullable |
| version | INTEGER | NOT NULL DEFAULT 0 |
| created_by | UUID | FK → UserAccount |
| created_at | TIMESTAMP |  |
| deleted_at | TIMESTAMP |  |

#### VestingEvent
| Field | Type | Notes |
| --- | --- | --- |
| vesting_id | UUID | PK |
| grant_id | UUID | FK |
| tenant_id | UUID | FK |
| vest_date | DATE | Interpreted in tenant timezone |
| shares_vested | DECIMAL(12,3) | NOT NULL >0, uses Round half to even |
| pps_snapshot | DECIMAL(12,3) | nullable. Represents the PPS effective on `vest_date`. See Section 4.1. |
| created_by | UUID | FK → UserAccount |
| created_at | TIMESTAMP | UTC |

<!-- Termination table removed - fields integrated into Grant table -->

#### AuditLog
| Field | Type | Notes |
| --- | --- | --- |
| log_id | UUID | PK |
| tenant_id | UUID | FK |
| user_id | UUID | FK | nullable |
| action_type | VARCHAR(40) |  |
| entity_type | VARCHAR(40) | nullable |
| entity_id | UUID | nullable |
| details | JSONB | NOT NULL CHECK (jsonb_typeof(details->'before') IN ('object', 'null') AND jsonb_typeof(details->'after') IN ('object', 'null')) |
| created_at | TIMESTAMP |  |

*UNIQUE* = partial unique (`tenant_id`,`email`) WHERE deleted_at IS NULL.

FK ON DELETE RESTRICT for user‑facing entities; CASCADE for child rows (e.g., vesting_events -> grants).

---

## 4. Key Business Logic & Rules

### 4.1 Vesting Algorithm
1. **Accrual start**: the day after `grant_date`.
2. **Cliff**: No shares accessible before the 1‑year anniversary (calculated based on `grant_date` interpreted in tenant timezone).
3. At month 13, unlock `share_amount × 12 / 48`, rounded 3 dp using **Round half to even**.
4. Months 14–48: unlock `share_amount / 48` monthly, rounded 3 dp using **Round half to even**.
5. Apply month‑end and leap‑year rules (calculations based on tenant timezone).
6. Adjust tranche 48 for rounding so Σ = `share_amount`. Calculation: `final_tranche = total_share_amount - SUM(shares_vested_in_tranches_1_to_47)`.
7. **PPS Snapshot**: The `pps_snapshot` stored on a `VestingEvent` is determined by looking up the effective Price Per Share from `PPSHistory` on the `VestingEvent.vest_date` (using the same logic as the current PPS lookup in Section 2.2: `WHERE tenant_id = ? AND effective_date <= vest_date ORDER BY effective_date DESC, created_at DESC LIMIT 1`).
8. **PPS Snapshot Updates**: If a `PPSHistory` record is created or updated (including backdated entries), the system **must** trigger an update to the `pps_snapshot` field for all existing `VestingEvent` records whose `vest_date` is affected by this new PPS value (i.e., the `vest_date` falls on or after the new `effective_date` and before the `effective_date` of the *next* PPS entry, if one exists). This ensures historical vesting values reflect the most accurate PPS information.

### 4.2 Pool Math & Concurrency
All grant creation (`POST /grants`), termination (`POST /grants/{id}/terminate`), and pool adjustments (`POST /pools/{pool_id}/events`) **must** be routed through the `sp_adjust_pool()` stored procedure, executed under `SERIALIZABLE` transaction isolation level, to prevent race conditions and ensure pool integrity (`0 ≤ Available ≤ TotalPool`). Other writes should use `READ COMMITTED` + optimistic locking (`version` column where applicable, e.g., on `Grant`).

### 4.3 Edge‑Case Matrix

| Scenario | Expected Outcome |
| --- | --- |
| Feb 29 grant, non‑leap year | Vests Feb 28. |
| 31‑Jan grant, Feb 2026 | Vests Feb 28. |
| Terminate on grant_date | 100% returned. |
| Termination on cliff day | Accrued shares stay vested. |
| Termination on cliff day | Accrued shares stay vested. |

---

## 5. API Overview

### 5.1 Envelope
Success: `{"success":true,"data":{}}`

### 5.2 Base URL & Formats
Base: `https://api.rsu-platform.com/api`

Dates in payloads (e.g., `YYYY-MM-DD` strings) **must** be interpreted relative to the `Tenant.timezone`. Timestamps should generally be UTC (`YYYY-MM-DDTHH:mm:ss.sssZ`) but converted to tenant timezone for display where appropriate. Database functions relying on a "current date" (like `CURRENT_DATE`) **must** be used within a context that correctly resolves the date based on the specific tenant's timezone.

Pagination via `?page=&limit=`.

### 5.3 Endpoints

| Area | Methods |
| --- | --- |
| Auth | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/revoke` |
| Tenant | `GET /tenant`, `PATCH /tenant` |
| Users | `POST /users`, `GET /users`, `PATCH /users/{id}`, `DELETE /users/{id}` |
| Employees | CRUD endpoints analogous to Users |
| Pool | `GET /pools`, `POST /pools/{id}/events`, `GET /pools/{id}/events` |
| PPS | `GET /pps/current`, `GET /pps`, `POST /pps` |
| Grants | `POST /grants`, `GET /grants/{id}`, `PATCH /grants/{id}` |
| Vesting | `POST /grants/{id}/calculate-vesting`, `GET /grants/{id}/vesting-events` |
| Termination | `POST /grants/{id}/terminate` (updates grant record) |
| Audit Logs | `GET /audit-logs`, `GET /audit-logs/download` |
| Constants | `GET /constants/currencies` |
| Health | `GET /health` |

Full schemas in `/docs/api.yml`.

---

## 6. Security & Operations

### 6.1 Authentication & Authorization
- BCrypt cost 12.
- JWT contains `user_id`, `tenant_id`, `scope`.
- JWT lifetime: 24 hours for access tokens, 7 days for refresh tokens.
- Auth endpoints:
  - `POST /auth/login` (returns access token + refresh token)
  - `POST /auth/refresh` (exchanges refresh token for new access token)
  - `POST /auth/revoke` (blacklists current token)
- Token revocation via Redis-backed blacklist.
- MFA implementation scheduled for v1.1.

### 6.2 Data Security
- All traffic via TLS 1.3.
- Daily encrypted backups.

### 6.3 Infrastructure & Operations
- PostgreSQL 15.
- Critical writes performed in SERIALIZABLE transactions.
- Prometheus metrics; `/health` endpoint.
- Service deployed in Docker containers; probes hit `/health`.
- Metrics collection via Prometheus/Grafana to track success metrics.
- Automated alerting for error rates, latency thresholds, and availability.

---

## 7. Technical Architecture
Node.js (Express) + PostgreSQL 15 + Redis; Kubernetes deployment.
- Sequelize ORM with version column for optimistic locking.
- Worker process for daily vesting batch.

---

## 8. UX Principles
- Clean responsive UI, numbers displayed with 3 dp.
- Minimalistic design, trailing zeros trimmed.
- Confirmation modals for destructive actions.

---

## 9. Naming & Consistency Guide
- Snake_case, plural API paths, CI schema diff check.
- Tables & fields: **snake_case**.
- Date columns end with `_date`; timestamps end with `_at`.
- FK columns `<entity>_id`.
- Enums lower‑case single words.
- **Breaking‑Change Checklist**: rename fields, alter enums, or change decimal scale → bump API version & run migrations.

---

## 10. Implementation Timeline

| Phase | Deliverables | Duration |
| --- | --- | --- |
| 1 | Schema, auth, pool/grant CRUD, PPS | 4 wks |
| 2 | Admin & Employee web portals (React) | 4 wks |
| 3 | Vesting engine, termination, audit log | 3 wks |
| 4 | QA & launch prep | 1 wk |
| **Total** | **MVP GA** | **12 wks** |

Post‑MVP (v1.1): CSV import, viewer role, configurable schedules (target +8 weeks).

---

## 11. Success Metrics

### 11.1 Technical

| Metric | Target |
| --- | --- |
| Uptime | ≥99.5% |
| 95th‑percentile API latency | ≤500 ms |
| Error rate | <1% requests |
| Vesting accuracy | 100% automated tests pass |

### 11.2 Business

| Metric | Target |
| --- | --- |
| Employee portal adoption | ≥80% employees log in within 30 days |
| Admin grant creation time | <5 min average |
| Customer satisfaction (CSAT) | ≥80% positive |

---

## 12. Integration Test Scenario

Automated E2E (jest + supertest):

1. Admin signup → Tenant & Admin created.
2. Create pool (100 shares).
3. Set PPS (USD 1).
4. Create employee Jane.
5. Grant 20 shares to Jane.
6. Terminate grant on day one; expect `unvested_returned = 20.000` & pool Available = 100.
7. Create second grant of 20 shares to Jane.
8. Forward clock 13 months; calculate vesting; expect vested = 5.000 shares (12/48 of 20).
9. Fetch audit logs; expect ≥8 records.
10. All assertions pass.

---

## 13. System Initialization

### 13.1 Tenant Setup
The system initialization process follows these steps:

1. System administrator creates first tenant via management console.
2. Initial admin user is created for the tenant.
3. Admin receives invitation email with temporary credentials.
4. Admin logs in and creates equity pool with initial allocation.
5. Admin sets initial PPS (Price Per Share).

### 13.2 Bootstrap Data
The following reference data is pre-loaded:

1. Currency symbols mapping
2. Default report templates
3. System-wide configuration parameters
4. Default email templates

### 13.3 Validation Rules
All API requests are validated against the JSON Schema definitions in the OpenAPI specification. Common validation rules include:

- Email addresses must be valid per RFC 5322
- All monetary amounts must be non-negative and maximum 3 decimal places
- All required fields must be present
- String lengths must not exceed defined maximums
- Dates must be valid ISO-8601 format

## 14. Change Log
- May 8, 2025: Full canonical specification—functional‑risk and data‑integrity gaps closed: unified enums, positive‑only PoolEvents, created_by everywhere, NOT NULL defaults, uniform DECIMAL(12,3), partial‑unique indexes, ISO currency code only.
- May 6, 2025: Initial full MVP spec completed.