Okay, let's break down the development into logical, independent stages, focusing on delivering a testable web application increment at each step, following good Software Development Life Cycle (SDLC) practices.

The goal is to build the platform layer by layer, ensuring each layer is solid before building on top of it. Each stage will include backend API development, database setup, and a basic frontend (web app) component for interaction and testing.

Here are the proposed stages:

## Stage 0: Foundation & Setup (Internal - Not a user-facing deliverable)
Goal: Prepare the development environment, source code repository, basic project structure, and Continuous Integration/Continuous Deployment (CI/CD) pipeline.
SDLC Focus: Planning, Initial Setup.

Checklist:
[\x] Code repository created (e.g., Git).
[\x] Basic project structure defined (backend, frontend, database migrations).
[\x] Tech stack selected & initialised (e.g., Node.js/Express, PostgreSQL, Vue 3/PrimeVue).
[\x] Dependency management set up (e.g., package.json).
[\x] Basic Docker configuration (for local dev & deployment).
[\x] Initial database schema setup (migration tool configured).
[\x] Basic logging framework configured.
[\x] Basic configuration management (environment variables).
[\ ] Initial CI pipeline set up (e.g., linting, basic build checks).
[\ ] Basic deployment script/pipeline to a staging environment.
[\x] README file created with setup instructions.

## Stage 1: Core Identity & Tenant Management (Using Auth0)

*   **Goal:** Integrate Auth0 for user authentication. Allow users (initially Admins) sign up/log in via Auth0. Implement backend validation for Auth0 tokens. Allow logged-in Admins to manage basic tenant settings and view users.
*   **SDLC Focus:** Auth0 Configuration, Design (DB Schema changes, Basic UI), Implementation (Backend API Middleware/Routes, Frontend Auth0 Integration), Testing (Unit, Integration, E2E for login/tenant view), Deployment (to Staging).
*   **Note:** Basic audit logging for Tenant Update and User CUD operations implemented.
*   **Key Features:**
    *   Auth0 Configuration (Tenant, Application, API, Rules/Actions if needed).
    *   Auth0 Universal Login flow setup for Frontend.
    *   Backend middleware to validate Auth0 Access Tokens.
    *   Initial User/Tenant setup (manual DB seeding or first admin signup via Auth0).
    *   Linking Auth0 user ID (`sub`) to internal `user_accounts` record (e.g., on first API access).
    *   Tenant API: GET /api/tenant (view current tenant details).
    *   Tenant API: PATCH /api/tenant (update current tenant details - e.g., name, timezone).
    *   User API: GET /api/users (list users in current tenant).
    *   User API: POST /api/users (invite/create new user in current tenant - initially by Admin).
    *   User API: PATCH /api/users/{id} (update user details - e.g., role, status by Admin).
    *   User API: DELETE /api/users/{id} (deactivate/soft-delete user by Admin).
    *   Frontend: Basic Dashboard displaying logged-in user's tenant information.
    *   Frontend: Basic Tenant Management page (view/edit tenant details).
    *   Frontend: Basic User Management page (list, invite, edit, deactivate users).
*   **Checklist:**
    *   **Auth0 & Backend Core:**
        *   [x] Decide on Auth0 for authentication.
        *   [x] Database changes: `user_accounts` table updated (remove `password_hash`, add `auth0_user_id`).
        *   [x] Reset DB and re-apply initial migration.
        *   [x] API spec (`api.yml`) updated: Remove `/auth/*` paths, adjust User schemas, add Auth0 security definitions.
        *   [x] Old backend auth code deleted (`password.js`, `jwt.js`, `auth.js` routes).
        *   [x] Auth0 middleware library installed (`express-oauth2-jwt-bearer`).
        *   [x] Backend `auth.js` middleware implemented (`checkJwt`, `syncUser` - finds/creates local user from Auth0 token).
        *   [x] Backend `index.js` updated to use Auth0 middleware and initialize DB pool correctly (resolved circular dependency for pool).
        *   [x] Configure Auth0 Application (SPA - e.g., "Kiwi3 Frontend") - Record Domain, Client ID. Set Callback/Logout/Web Origin URLs.
        *   [x] Configure Auth0 API (Resource Server - e.g., "Kiwi3 Backend API") - Record Identifier (Audience). Enable RBAC & Add Permissions From Claims.
        *   [x] Create Auth0 Action (Post Login) to add custom namespaced claims (`tenant_id`, `roles`, `email`, `name`) to Access & ID tokens. (Verified working)
        *   [x] Set necessary Auth0 related environment variables in `.env` and `docker-compose.yml` (`AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE`).
        *   [x] Backend `tenant.js` routes (GET / PATCH) implemented and use Auth0 middleware + role auth.
        *   [x] Backend `user.js` routes (POST / GET / PATCH / DELETE) implemented and use Auth0 middleware + role auth.
        *   [x] CORS middleware configured correctly in backend.
    *   **Frontend Core:**
        *   [x] Auth0 Vue SDK (`@auth0/auth0-vue`) installed.
        *   [x] Auth0 plugin initialized in `main.js` with env vars (Domain, ClientID, Audience, scope: openid profile email).
        *   [x] `App.vue` uses `useAuth0` for login/logout buttons and user state.
        *   [x] `apiClient.js` correctly gets Access Token using the exported `auth0` instance to include in API request headers.
        *   [x] Tenant data successfully fetched and displayed on Dashboard (`GET /api/tenant`).
    *   **Tenant Management:**
        *   [x] API: `GET /api/tenant` (View current tenant details - Displayed on Dashboard).
        *   [x] API: `PATCH /api/tenant` (Update current tenant - name, timezone, etc.).
        *   [x] Frontend: Tenant details displayed on a dedicated page or section (using `TenantSettings.vue`).
        *   [x] Frontend: Edit functionality implemented for tenant details (name, timezone).
    *   **User Management:**
        *   [x] API: `GET /api/users` (List users in current tenant).
        *   [x] API: `POST /api/users` (invite/create new user - Admin only).
        *   [x] API: `GET /api/users/{id}` (Get specific user - Admin only).
        *   [x] API: `PATCH /api/users/{id}` (Update user details - Admin only).
        *   [x] API: `DELETE /api/users/{id}` (Deactivate user - Admin only).
        *   [x] Frontend: User Management page/section created.
        *   [x] Frontend: List users functionality implemented (`GET /api/users`).
        *   [x] Frontend: Invite/Create user functionality implemented (`POST /api/users`).
        *   [x] Frontend: Edit user functionality implemented (`PATCH /api/users/{id}`).
        *   [x] Frontend: Deactivate user functionality implemented (`DELETE /api/users/{id}`).
    *   **Testing & Deployment:**
        *   [x] Basic E2E testing framework (Cypress) set up and configured.
        *   [x] Initial E2E smoke test (application load) implemented and passing.
        *   [x] E2E test authentication implemented with Auth0 mocking, avoiding need for real Auth0 credentials.
        *   [x] Backend testing architecture established: Unit tests, integration tests with Auth0 middleware mocking.
        *   [x] Transaction-based test isolation implemented for integration tests.
        *   [x] Backend test for tenant API passes successfully.
        *   [x] Test database helper implemented with consistent test fixtures.
        *   [x] Integration test base class created for standardized test writing.
        *   [x] Separate test environments configured for unit, integration, and E2E tests.
        *   [x] Verify soft delete behavior for Users (e.g., deleted users cannot log in via Auth0 if status synced, or API access denied).
    *   **Documentation:**
        *   [x] API documentation updated (removed `/auth/*`, noted Auth0 requirement).
        *   [x] README updated with Auth0 setup requirements for local dev (references Auth0-Setup.md).
        *   [x] Auth0 setup guide (`Auth0-Setup.md`) created.

    *   **~~Current PostgreSQL Connection Issue (Host to Container):~~ RESOLVED**
        *   **Status:** Resolved. Backend tests requiring host-to-container DB connection now pass.
        *   **Problem Summary**: Backend Jest tests (running on host) failed to connect to the test DB (`kiwi3_test` initially, then `uniquedb456`) inside the Docker container, showing errors like "database does not exist" or "relation does not exist".
        *   **Root Cause**: Mismatch between the declared migration tool standard (Knex.js) and the implementation. The `migrate` service in Docker Compose was incorrectly configured to use `node-pg-migrate`, while migration files were written in Knex syntax. Additionally, configuration in `.env`, `knexfile.js`, and `docker-compose.yml` needed alignment for database names and connection methods (using `DATABASE_URL` within containers).
        *   **Resolution**:
            *   Standardized migration execution on Knex by updating `database/package.json` scripts and dependencies.
            *   Updated the `migrate` service in `docker-compose.yml` to use `knex migrate:latest` and a compatible Node version (20).
            *   Corrected `knexfile.js` to properly use `DATABASE_URL` when running inside the `migrate` container.
            *   Aligned test database name (`DB_NAME_TEST`) in `.env` and `knexfile.js` (`test` environment) to match the database created by Docker Compose (`uniquedb456`).
            *   Renamed malformed migration filename `YYYYMMDDHHMMSS_create_audit_logs_table.js` to use a valid timestamp prefix.
        *   **Outcome**: Migrations now run successfully using Knex via the `migrate` service, and backend Jest tests connect to the test database and pass.

## Stage 2: Equity Pool & Price Per Share (PPS) Management
Goal: Allow Admins to set up and manage the company's equity pool and its price per share history.
SDLC Focus: Design (DB Schema for Pool/Event/PPS, UI), Implementation, Testing, Deployment.
Key Features:
Equity Pool setup (creation implied with Tenant, or a separate step - Clarify based on Sec 13.1 - let's assume first pool setup needed).
Viewing Pool Metrics (GET /pools - display calculated total_pool, granted_shares, returned_shares, available_shares). Note: granted/returned correctly handled as 0 for Stage 2.
Managing Pool Events (POST /pools/{pool_id}/events, GET /pools/{pool_id}/events - for top-ups/reductions).
Setting PPS (POST /pps).
Viewing PPS History (GET /pps, GET /pps/current).
Frontend: Admin page to view Pool metrics, list Pool events, add new Pool events (top-up/reduction). Admin page to view PPS history, view current PPS, add new PPS values.
Constants API (GET /constants/currencies) implemented.
Basic Audit Logging for Pool Event creation and PPS creation implemented.

Checklist:
Backend:
[x] Database schemas for EquityPool, PoolEvent, PPSHistory created and migrated (standardized on Knex.js).
[x] Logic for initial EquityPool creation defined (e.g., first admin action).
[x] sf_adjust_pool() stored function created (Stage 2 version, handles only pool events, no grant dependency).
[x] /pools (GET) endpoint implemented, returns calculated metrics (using DecimalString, granted/returned = 0).
[x] /pools/{pool_id}/events (GET, POST) implemented, POST uses sf_adjust_pool with SERIALIZABLE isolation. Enforces signed amount.
[x] /pps (GET, POST), /pps/current implemented. Uses DecimalString, enforces price > 0. Handles duplicate effective_date logic (latest created_at wins in lookup).
[x] GET /constants/currencies endpoint implemented.
[x] created_by field correctly populated for PoolEvent, PPSHistory.
[x] Pool integrity constraints (available check, non-negative total) enforced via sf_adjust_pool.
[x] Basic audit logging implemented for state-changing actions (Pool Event Create, PPS Create).
[x] Unit tests for Pool/PPS logic, validations, SP interaction pass.
[x] API integration tests for Pool/PPS endpoints pass.
Frontend:
[\] Admin UI page for Equity Pool: Displays metrics, lists events, form to add new event (calls POST /pools/{pool_id}/events).
[x] Admin UI page for PPS: Displays current PPS, lists history, form to add new PPS (calls POST /pps).
[x] Input validation for decimal strings on forms.
[x] Displays numbers using 3 decimal places consistently.
Testing & Deployment:
[ ] E2E tests (Admin logs in, sets up pool, adds pool event, sets PPS, views history) pass.
[x] Stage deployed to staging environment.
[\] Manual UAT performed on staging (Can Admin manage Pool & PPS?).
[\] Code reviewed.
Documentation:
[x] API docs updated.
[x] README updated.
[x] specification.md updated for UserAccount/Auth changes.

## Recent Troubleshooting Progress

### Authentication and API Access
[x] Ensured Auth0 audience values are consistent across frontend and backend.
[x] Verified token attachment and refresh mechanisms in API requests.
[x] Updated frontend and backend configurations for token validation and refresh.

### Docker and Environment Setup
[x] Confirmed Docker setup for frontend and backend services.
[x] Ensured environment variables are correctly set in `.env` and `docker-compose.yml`.

### Frontend and Backend Integration
[x] Verified frontend components communicate correctly with backend API endpoints.
[x] Ensured API client files are consistent with expected API URLs.

### Testing and Deployment
[x] Conducted manual testing of API endpoints using curl.
[x] Updated testing framework to include tests for authentication and API access.

### Documentation
[x] Updated documentation to reflect current application state, including Auth0 setup and API specifications.

### Database Issues
[x] Fixed "relation 'equity_pools' does not exist" error by converting migration file to node-pg-migrate format.
[x] Fixed "relation 'pps_history' does not exist" error by applying migration correctly.
[x] Successfully created an equity pool with 1,000 shares.
[x] Added an initial pool event.
[x] Set initial price per share of $10.00.
[x] Standardized migrations on Knex.js.
[x] Created audit_logs table migration.
[x] Created sf_adjust_pool stored function (Stage 2 version).

### Backend API
[x] Implemented Pool and PPS API endpoints.
[x] Implemented Constants API endpoint.
[x] Integrated sf_adjust_pool usage with SERIALIZABLE isolation for Pool Event creation.
[x] Corrected Pool Metrics calculation for Stage 2.
[x] Added basic IANA timezone validation for Tenant updates.
[x] Improved Health Check with DB status.
[x] Added basic Audit Logging for Tenant, User, Pool Event, PPS state changes.

### Frontend Configuration
[x] Fixed localhost:8080 access issues by updating Vite configuration.
[x] Configured Docker setup to serve frontend correctly.
[x] Added proper configuration for frontend port handling (see frontend/vite.config.js).
[x] Built static version of frontend and served with Nginx.

### Frontend Components 
[x] Fixed "Cannot read properties of undefined (reading 'items')" error in PPS history component.
[x] Updated frontend code to handle different possible data structures from API.
[x] Verified connectivity between frontend components and backend API endpoints.

### Remaining Issues
[x] ~~**Need to Fix Test Environment Database Connection**~~ (Resolved)
[ ] Enhance test coverage (Audit Log creation, sf_adjust_pool usage verification if possible, Health Check DB status).
[ ] Optimize data loading in frontend components for better performance.
[ ] Fix any remaining console errors related to undefined properties.
[ ] Implement remaining frontend UI components for Stage 2 (Equity Pool management page).
[ ] Complete end-to-end testing for critical user journeys.

## Next Steps
1.  Implement the Admin UI page for Equity Pool management (Frontend).
2.  Enhance backend test coverage (now unblocked).
3.  Add proper error handling for all API requests in frontend components.
5.  Update documentation (README, etc.) to reflect the current state of the application.
6.  Prepare for Stage 3 implementation: Employee & Basic Grant Management.

## Stage 3: Employee & Basic Grant Management
Goal: Allow Admins to manage employees and issue basic RSU grants. Allow Employees to log in and see their grants (without vesting details yet).
SDLC Focus: Design (DB Schema for Employee/Grant, UI), Implementation, Testing, Deployment.
Key Features:
Employee Management (POST /employees, GET /employees, GET /employees/{id}, PATCH /employees/{id}, DELETE /employees/{id} - soft delete). Includes bulk create (POST /employees/bulk).
Grant Creation (POST /grants, POST /grants/bulk). Must validate against Available shares in the pool.
Grant Viewing (GET /grants, GET /grants/{id}).
Employee Login (using /auth/login created in Stage 1, now for employee role).
Basic Employee Grant View (GET /employees/{employee_id}/grants-summary or filtered GET /grants?employee_id=...).
Frontend: Admin pages for Employee CRUD & Bulk Create. Admin page for Grant CRUD & Bulk Create. Employee view to list their own grants (basic info: grant date, share amount).

Checklist:
Backend:
[\ ] Database schemas for Employee, Grant created and migrated.
[\ ] /employees/* endpoints implemented per api.yml.
[\ ] /grants (POST, GET), /grants/bulk (POST), /grants/{grant_id} (GET, PATCH - limited scope initially, DELETE - soft delete) implemented.
[\ ] Grant.version field implemented for optimistic locking base.
[\ ] POST /grants uses sp_adjust_pool (updated to handle grant creation) with SERIALIZABLE isolation and validates share_amount <= Available.
[\ ] created_by populated for Employee, Grant.
[\ ] Authorization distinguishes between Admin (can manage all) and Employee (can only view own grants).
[\ ] /employees/{employee_id}/grants-summary endpoint implemented.
[\ ] Unit tests for Employee/Grant logic, validation, pool interaction pass.
[\ ] API integration tests for Employee/Grant endpoints pass.
Frontend:
[\ ] Admin UI pages for Employee CRUD and bulk upload/creation.
[\ ] Admin UI pages for Grant creation (single/bulk), listing/viewing grants.
[\ ] Employee login flow works.
[\ ] Employee UI page to view "My Grants" (list view using summary endpoint or filtered list). Shows basic details like grant date, total shares.
Testing & Deployment:
[\ ] E2E tests (Admin adds employee, creates grant; Employee logs in, sees grant) pass.
[\ ] Stage deployed to staging environment.
[\ ] Manual UAT performed (Admin can manage Employees/Grants? Employee can log in and see basic grant info?).
[\ ] Code reviewed.
Documentation:
[\ ] API docs updated.
[\ ] README updated.

## Stage 4: Vesting Engine Implementation & Display
Goal: Implement the core vesting calculation logic and display vesting schedules/progress to employees and admins.
SDLC Focus: Implementation (Complex Logic), Testing (Critical Logic), Deployment.
Key Features:
Vesting Event Calculation Logic (backend implementation based on Sec 4.1 rules: cliff, monthly, rounding, month-end, leap year, final tranche).
Vesting Event Database Schema (VestingEvent table, Grant.vested_amount updates).
Vesting Calculation API (POST /grants/{grant_id}/calculate-vesting).
Daily Batch Vesting Job (backend worker process).
PPS Snapshotting Logic (including update triggers from PPS changes - Sec 4.1.8).
Viewing Vesting Events (GET /grants/{grant_id}/vesting-events).
Frontend: Enhance Employee "My Grants" view to show vesting schedule, vested amount, total value (using snapshot or current PPS). Enhance Admin grant view to show vesting events. Maybe add Admin button to trigger /calculate-vesting.
Checklist:
Backend:
[\ ] Database schema for VestingEvent created and migrated.
[\ ] Grant.vested_amount column exists and is used.
[\ ] Core vesting algorithm implemented correctly respecting all rules (Sec 4.1), including rounding.
[\ ] POST /grants/{grant_id}/calculate-vesting implemented: idempotent, creates events, updates Grant.vested_amount atomically, populates pps_snapshot correctly, uses locking (optimistic/pessimistic).
[\ ] GET /grants/{grant_id}/vesting-events implemented.
[\ ] Daily batch worker implemented: identifies eligible grants per tenant timezone, calls vesting logic, handles concurrency.
[\ ] Logic implemented to update VestingEvent.pps_snapshot when relevant PPSHistory entries are created/updated.
[\ ] Unit tests for vesting algorithm edge cases (leap year, month-end, rounding, final tranche), PPS snapshotting logic, batch job query pass exhaustively.
[\ ] API integration tests for vesting endpoints pass.
[\ ] Integration test simulating batch job run passes.
[\ ] Test for PPS snapshot updates passes.
Frontend:
[\ ] Employee "My Grants" view enhanced: shows detailed vesting schedule (past/future dates, amounts), highlights cliff, shows vested/unvested totals. Displays value based on PPS.
[\ ] Admin grant view enhanced: shows associated vesting events.
[\ ] (Optional) Admin button to trigger calculate-vesting API for a specific grant.
Testing & Deployment:
[\ ] E2E tests (Grant created, time passes/batch runs/API called, vesting events appear, employee/admin views updated) pass.
[\ ] Rigorous testing of vesting calculations against scenarios from Sec 4.3 and other edge cases.
[\ ] Stage deployed to staging environment.
[\ ] Manual UAT performed (Vesting schedules look correct? Amounts match expectations? Batch job runs correctly?).
[\ ] Code reviewed, especially vesting logic.
Documentation:
[\ ] API docs updated.
[\ ] README updated (batch job setup/run).

## Stage 5: Termination Workflow
Goal: Implement the process for terminating a grant, calculating returned shares, and updating status.
SDLC Focus: Implementation, Testing (Interaction Effects), Deployment.
Key Features:
Termination API (POST /grants/{grant_id}/terminate).
Logic to calculate unvested_shares_returned based on current vested_amount.
Interaction with sp_adjust_pool to return shares.
Update Grant status (active -> inactive), store termination_date, reason, notes, terminated_by.
Frontend: Add "Terminate" action/button/modal to the Admin grant view. Display termination info on terminated grants. Ensure terminated grants are clearly marked/filtered.
Checklist:
Backend:
[\ ] POST /grants/{grant_id}/terminate implemented per api.yml using TerminateGrantRequest.
[\ ] Termination logic correctly calculates unvested_shares_returned.
[\ ] Grant status updated to inactive, termination fields populated.
[\ ] sp_adjust_pool updated to handle returned shares, transaction uses SERIALIZABLE isolation.
[\ ] Pool metrics correctly reflect returned shares after termination.
[\ ] Terminated grants (inactive) are excluded from future vesting calculations (batch job/API).
[\ ] Unit tests for termination calculation logic pass.
[\ ] API integration tests for termination endpoint, verifying grant state and pool metrics, pass.
Frontend:
[\ ] Admin grant view includes a "Terminate" action.
[\ ] Termination modal/form collects date, reason, notes.
[\ ] Admin/Employee grant views clearly indicate terminated grants and show termination details.
[\ ] Pool metrics display updates correctly after termination.
Testing & Deployment:
[\ ] E2E tests (Admin terminates grant, grant status changes, pool updates, employee view updates) pass.
[\ ] Test termination edge cases (terminate on grant date, terminate after partial vesting).
[\ ] Stage deployed to staging environment.
[\ ] Manual UAT performed (Termination flow works as expected? Data updates correctly?).
[\ ] Code reviewed.
Documentation:
[\ ] API docs updated.
[\ ] README updated.

## Stage 6: Audit Logging & Final Polish
Goal: Implement comprehensive audit logging and perform final testing, UI polish, and documentation cleanup for the MVP.
SDLC Focus: Implementation (Cross-cutting concern), Testing (Holistic), Deployment (MVP Candidate).
Key Features:
Audit Log Backend (AuditLog table, logic to capture changes).
Capture key events (User login, Tenant update, Pool event, PPS create/delete, Employee CRUD, Grant create/terminate, Vesting calculation trigger). Store before/after state where applicable.
Audit Log API (GET /audit-logs, GET /audit-logs/download).
Constants API (GET /constants/currencies).
Health Check API (GET /health).
Frontend: Admin page to view/filter Audit Logs. Allow CSV download. Ensure all previous stage UIs are cohesive and polished. Final check on 3dp display everywhere.
Checklist:
Backend:
[\ ] Database schema for AuditLog created and migrated.
[\ ] Logic implemented to automatically create AuditLog entries for specified actions, capturing relevant details (user_id, action_type, entity, details with before/after).
[\ ] /audit-logs (GET list with filtering), /audit-logs/download (GET CSV) implemented.
[\ ] /constants/currencies endpoint implemented.
[\ ] /health endpoint implemented.
[\ ] Unit tests for audit log creation helpers, API endpoint logic pass.
[\ ] API integration tests for audit log endpoints (filtering, download) pass.
Frontend:
[\ ] Admin UI page for viewing Audit Logs with filtering options.
[\ ] Audit Log download functionality implemented.
[\ ] Final review of all UI pages for consistency, usability, responsiveness, and 3dp display.
[\ ] Ensure "Not tax advice" disclaimer is present where needed (Employee portal).
Testing & Deployment:
[\ ] E2E tests covering major flows from all stages pass. Include checking audit log entries are created.
[\ ] Perform holistic manual UAT covering all MVP features.
[\ ] Basic performance check (API response times under load?).
[\ ] Security scan/review performed.
[\ ] Stage deployed to staging environment as MVP Release Candidate.
[\ ] Final code review.
Documentation:
[\ ] Final review and update of API documentation.
[\ ] Final review and update of READMEs (setup, run, deployment).
[\ ] Basic user guide/notes drafted (optional).
Moving Between Stages:
Before moving to the next stage, all checklist items for the current stage must be completed and verified ("airtight").
A demo of the current stage's functionality should be reviewed.
Any critical bugs found during UAT must be fixed before proceeding.
Ensure the staging environment reflects the completed, stable state of the current stage.
This staged approach breaks the project into manageable chunks, provides testable increments, and incorporates SDLC best practices at each step, helping ensure a solid MVP.
