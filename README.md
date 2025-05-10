# RSU/ESOP Platform (Kiwi3)

This repository contains the source code for the RSU/ESOP management platform specified in `SPECIFICATION.md` and `api.yml`.

## Project Structure

- `backend/`: Node.js (Express) API server.
- `frontend/`: Vue 3 (PrimeVue) web application.
- `database/`: PostgreSQL database migration scripts (Knex.js) and configuration.
- `SPECIFICATION.md`: Functional and technical specification.
- `api.yml`: OpenAPI (v3) specification for the backend API.
- `docker-compose.yml`: Docker configuration for local development environment.
- `.env.example`: Example environment variables required.

## Current Status (as per PLAN.md)

*   **Stage 1 (Core Identity & Tenant Management):** Largely complete (Auth0 integration, Tenant/User CRUD APIs & basic frontend views).
*   **Stage 2 (Equity Pool & PPS Management):** Backend logic implemented (Pool/PPS CRUD APIs, Constants API, Basic Audit Logging). Backend tests passing. Frontend page for PPS exists; Pool management frontend page pending.
*   **Stage 3 (Employee & Grant Management):** Not started.
*   **Stage 4 (Vesting Engine):** Not started.
*   **Testing**: Backend integration tests for Stage 1 & 2 are passing. Cypress E2E setup exists.

## Setup & Development

### Prerequisites

- Docker & Docker Compose
- Node.js (v18 or later recommended for consistency)
- npm
- Auth0 Account (configure Application and API as per `Auth0-Setup.md`).
- Access to a PostgreSQL instance (local or Dockerized). The `docker-compose.yml` provides a development database service.

### Environment Variables

1.  Copy `.env.example` to `.env` in the project root.
2.  Fill in the required values:
    *   Database credentials (`DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_HOST`, `DB_PORT`) for the *development* database.
    *   Test database name (`DB_NAME_TEST`).
    *   Auth0 credentials (`AUTH0_DOMAIN`, `AUTH0_AUDIENCE`).
    *   Frontend Auth0 credentials (`VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE` - these are used by the frontend build process).
    *   Ports if different from defaults.

    **Understanding Database Variables:**
    *   `DB_USER`, `DB_PASSWORD`: Credentials used by PostgreSQL. These are used both by the `postgres` service in Docker Compose to initialize the DB user, and by `knexfile.js` / tests connecting from the host.
    *   `DB_HOST`: Should typically be `localhost` in `.env`. This is used for connections *from your host machine* (e.g., running Jest tests, using `psql` locally) to the PostgreSQL container exposed via `DB_PORT`. Connections *within* the Docker network (e.g., `backend` service to `postgres` service) use the service name (`postgres`) as the host, which is handled internally via `DATABASE_URL` in `docker-compose.yml` and `knexfile.js`.
    *   `DB_PORT`: The port on your host machine that maps to the PostgreSQL container's port 5432. Default is `5432`.
    *   `DB_NAME`: The name for a *potential* general development database. **Note:** The primary database used by the Docker Compose setup is actually defined by `POSTGRES_DB` in `docker-compose.yml` (which defaults to `uniquedb456` if not overridden via `.env`).
    *   `DB_NAME_TEST`: The name of the database Jest tests will connect to *from the host*. **Crucially, for the standard Docker setup, this MUST match the `POSTGRES_DB` value used by the `postgres` service in `docker-compose.yml` (default: `uniquedb456`).** This ensures tests run against the database instance that the `migrate` service prepares.
    *   `DATABASE_URL`: This variable in `.env` is primarily for tools run *on the host* that need a connection string (e.g., running `knex` commands manually). It should use `localhost` as the host and ideally point to the test database (`DB_NAME_TEST`) for consistency. The `DATABASE_URL` *inside* `docker-compose.yml` is separate and uses the service name (`postgres`) for container-to-container communication.

    **Database Naming and Consistency (Default Docker Setup):**
    *   The `docker-compose.yml` file defines the initial database created by the `postgres` container via the `POSTGRES_DB` environment variable (e.g., `POSTGRES_DB: uniquedb456`).
    *   The `migrate` service connects to this database (using the `postgres` service name as the host) and applies migrations.
    *   The backend Jest tests run on your *host machine* and connect via `localhost` to the database specified by `DB_NAME_TEST` in your `.env` file.
    *   **Therefore, to ensure tests run against the correctly migrated database, the value of `DB_NAME_TEST` in `.env` must be the same as the value of `POSTGRES_DB` used in `docker-compose.yml` (default is `uniquedb456`).**
    *   You generally **should not need to change** these default names (`uniquedb456`) unless you are configuring a custom database setup outside the standard Docker Compose workflow. The alignment was necessary during troubleshooting because the test configuration was initially pointing to a different database (`kiwi3_test`) than the one Docker was creating and migrating (`uniquedb456`).

### Running Locally (using Docker Compose)

1.  **Ensure Docker Desktop / Docker Daemon is running.**
2.  **Build and Start Services:** From the project root directory (`/Users/suwandi/kiwi3`):
    ```bash
    docker compose build # Optional: needed only if you change dependencies or Dockerfiles
    docker compose up -d
    ```
    This starts the persistent services (`postgres`, `backend`, `frontend`) in detached mode.
3.  **Run Database Migrations:** Execute the migrations using the dedicated `migrate` service:
    ```bash
    docker compose up migrate
    ```
    This command runs the `migrate` service in the foreground, showing the output of the Knex migration process. It will exit once migrations are complete. Alternatively use `docker-compose run --rm migrate`.
4.  **Access Services:**
    *   The backend API should be available at `http://localhost:<BACKEND_PORT>` (default 3001). Health check: `http://localhost:3001/health`.
    *   The frontend should be available at `http://localhost:<FRONTEND_PORT>` (default 8080).

### Database Migrations (Knex.js)

*   **Note:** Database migrations are managed exclusively using Knex.js and are run via the `migrate` service defined in `docker-compose.yml`.
*   The `migrate` service uses the `DATABASE_URL` defined in `docker-compose.yml` (pointing to the `postgres` service) and the `development` environment settings in `knexfile.js`.
*   **Running Migrations:** Migrations should be run after starting the main services (`docker compose up -d`).
    ```bash
    # Run latest migrations (shows logs)
    docker compose up migrate 
    # Or run and remove container afterwards
    # docker compose run --rm migrate 
    ```
*   **Creating Migrations:**
    ```bash
    docker compose run --rm migrate npm run migrate:make -- -- <migration_name>
    ```
    This executes `knex migrate:make` inside the container using the correct configuration. The new migration file will appear in `./database/migrations` on your host machine.
*   **Rolling Back Migrations:**
    ```bash
    docker compose run --rm migrate npm run migrate:rollback
    ```

### Running Tests

*   **Backend Tests (Jest):**
    *   Requires the Docker Compose environment to be running (`docker compose up -d`), specifically the `postgres` service.
    *   **Connection:** Tests run on the host machine and connect to the PostgreSQL container via `localhost:<DB_PORT>` (using credentials from `.env`). They target the database specified by `DB_NAME_TEST` in `.env`.
    *   **Requirement:** As explained in the "Environment Variables" section, `DB_NAME_TEST` in `.env` **must match** the `POSTGRES_DB` value used by the `postgres` service in `docker-compose.yml` (default: `uniquedb456`) for tests to find the migrated schema.
    *   **Execution:** From the `/backend` directory:
        ```bash
        npm install # If not already done
        npm test
        ```
*   **Frontend E2E Tests (Cypress):**
    *   Requires the backend and frontend services to be running (via `docker compose up -d`).
    *   From the `/frontend` directory:
        ```bash
        npm install # If not already done
        # Opens the Cypress GUI
        npx cypress open 
    # Runs tests headlessly
    # npx cypress run
    ```

## API Documentation

See `api.yml` for the OpenAPI specification.

## Contributing

Please refer to `CONTRIBUTING.md` (if it exists) and follow the established coding conventions.

## Getting Started (Local Development using Docker)

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd kiwi3
    ```

2.  **Create Environment File:**
    Copy `.env.example` to `.env` and update the variables if necessary (especially database credentials if you are not using the defaults).
    ```bash
    cp .env.example .env
    ```

3.  **Build and Run Services:**
    This command will build the Docker images (if they don't exist) and start the persistent services (`postgres`, `backend`, `frontend`). The temporary `migrate` service is defined but not started automatically with `-d`.
    ```bash
    docker-compose up --build -d
    ```
    *   `-d` runs the services in detached mode.
    *   `--build` forces a rebuild of the images (usually only needed if Dockerfiles or dependencies change).

4.  **Run Database Migrations:**
    Execute the migration scripts using the dedicated `migrate` service (ensure services from step 3 are running):
    ```bash
    docker-compose up migrate
    ```
    *   This runs the `migrate` service in the foreground, applying migrations via Knex. It will exit when done. You should see output indicating the migrations were applied successfully.

5.  **Access the Application:**
    *   **Frontend:** Open your browser to `http://localhost:8080` (or the `FRONTEND_PORT` you set in `.env`).
    *   **Backend API:** The API is accessible at `http://localhost:3001` (or `BACKEND_PORT`). The health check is at `http://localhost:3001/health`. You can use tools like Postman or curl to interact with it.

## Development Workflows

*   **Backend:** The `backend` service in `docker-compose.yml` mounts the local `backend` directory. Changes to the source code should trigger `nodemon` to restart the server automatically.
*   **Frontend:** The default `docker-compose.yml` setup builds the frontend and serves static files via Nginx. For frontend development with hot-reloading:
    1.  Comment out the default `frontend` service definition in `docker-compose.yml`.
    2.  Uncomment the alternative `frontend` service definition that uses `npm run dev` and mounts the source code.
    3.  You might need to adjust the port mapping (e.g., to `5173:5173` if using Vite's default).
    4.  Restart services: `docker-compose up -d --build frontend`
*   **Database Migrations:** Use the `migrate` service defined in `docker-compose.yml`.
    *   Create a new migration: `docker-compose run --rm migrate npm run migrate:make -- -- <migration_name>`
    *   Run migrations: `docker-compose up migrate` (runs `npm run migrate:latest`)
    *   Rollback migrations: `docker-compose run --rm migrate npm run migrate:rollback`
    *   *(Note: The `migrate` service runs `npm install` internally first to ensure `knex` is available)*

## Stopping Services

```bash
docker-compose down
```
To remove volumes (including database data): `docker-compose down -v`

## Known Issues

(Previously documented host-to-container DB connection issues related to migrations/tests have been resolved by standardizing on Knex.js and correcting configurations.)

## Next Steps (Stage 2/3)

Complete Stage 2 (Frontend Pool Management UI) and proceed with implementing Stage 3: Employee & Basic Grant Management.

## Auth0 Authentication Setup

This project uses Auth0 for user authentication and authorization. Detailed setup instructions for Auth0, including Application and API configuration, custom claims, and troubleshooting, can be found in [./Auth0-Setup.md](./Auth0-Setup.md).

### Key Auth0 Requirements for Local Development:

1.  **Auth0 Account and Tenant:** You will need an Auth0 account and a tenant.
2.  **Application (SPA):** Configure an Auth0 Application of type "Single Page Application" for the frontend. Note its Domain and Client ID.
    *   Set **Allowed Callback URLs**, **Allowed Logout URLs**, and **Allowed Web Origins** to include your local frontend development URL (e.g., `http://localhost:8080` if using the project's Docker setup for the frontend, or `http://localhost:5173` if running Vite directly).
3.  **API (Resource Server):** Configure an Auth0 API to represent your backend. Note its Identifier (this is your Audience).
4.  **Custom Claims Action:** Implement and deploy an Auth0 Action in the "Login" flow to add custom claims (`https://api.domain.com/tenant_id`, `https://api.domain.com/roles`) to the Access and ID tokens. These claims are read from the user's `app_metadata` in Auth0.
5.  **User `app_metadata`:** For users to successfully interact with tenant-specific data, their Auth0 profile must have `tenant_id` (a valid UUID corresponding to a tenant in the database) and `role` populated in their `app_metadata`.

### Environment Variables for Auth0:

*   **Frontend (`frontend/.env`):**
    ```env
    VITE_AUTH0_DOMAIN=YOUR_AUTH0_TENANT_DOMAIN
    VITE_AUTH0_CLIENT_ID=YOUR_AUTH0_SPA_CLIENT_ID
    VITE_AUTH0_AUDIENCE=YOUR_AUTH0_API_IDENTIFIER
    # VITE_API_BASE_URL defaults to http://localhost:3001/api if not set
    ```
*   **Backend (Project root `.env` for Docker Compose):
    ```env
    AUTH0_DOMAIN=YOUR_AUTH0_TENANT_DOMAIN
    AUTH0_AUDIENCE=YOUR_AUTH0_API_IDENTIFIER
    FRONTEND_URL=http://localhost:8080 # For backend CORS configuration
    ```

Refer to [./Auth0-Setup.md](./Auth0-Setup.md) for more detailed steps.

## Running Migrations (Using Docker Compose)

Run latest migrations:
```bash
docker-compose up migrate
# OR
# docker-compose run --rm migrate
```
Create a new migration:
```bash
docker-compose run --rm migrate npm run migrate:make -- -- <migration_name>
```
Rollback the last migration batch:
```bash
docker-compose run --rm migrate npm run migrate:rollback
```

### Frontend (`./frontend`)

Built with Vue 3 and Vite. Uses PrimeVue for UI components.

**Setup:**

1.  **Install Dependencies:**
    ```bash
    cd frontend
    npm install
    ```
2.  **Environment Variables:** Create a `.env` file in the `frontend` directory based on `.env.example` (if provided) or manually add:
    ```dotenv
    VITE_API_BASE_URL=http://localhost:3001/api # Or your backend API URL
    VITE_AUTH0_DOMAIN=your_auth0_domain.us.auth0.com
    VITE_AUTH0_CLIENT_ID=your_auth0_spa_client_id
    VITE_AUTH0_AUDIENCE=your_auth0_api_identifier
    ```
3.  **PrimeVue Setup:**
    *   The project uses PrimeVue components and styling via CDN links in `index.html` for simplicity during initial development.
    *   **Important:** When using PrimeVue composables like `useToast` or `useConfirm`, ensure the corresponding service (`ToastService`, `ConfirmationService`) is registered in `frontend/src/main.js` using `app.use(ServiceName)`. Also, ensure the display component (`<Toast />`, `<ConfirmDialog />`) is included in your root template (e.g., `App.vue`).
4.  **Run Development Server:**
    *   **Directly:** `npm run dev` (Usually serves on `http://localhost:5173`)
    *   **Via Docker Compose:** The `docker-compose.yml` includes a `frontend` service that runs `npm run dev`. Access it via the mapped port (default `http://localhost:8080`). 

## Testing

This project includes comprehensive testing at multiple levels. For detailed information about the testing setup and implementation, refer to [./TESTS.md](./TESTS.md).

### Test Types

- **End-to-End (E2E) Tests**: Cypress-based tests that simulate real user interactions with the application.
- **Integration Tests**: Tests that verify the correct interaction between components (like API routes and the database).
- **Unit Tests**: Tests that focus on individual functions and components.

### Running Tests

- **Backend Tests**:
  ```bash
  cd backend
  npm test                     # Run all tests
  npm test -- --coverage       # Run tests with coverage reporting
  npm test -- <test-file-path> # Run specific test file
  ```

- **Frontend E2E Tests**:
  ```bash
  cd frontend
  # Run tests in interactive mode
  npx cypress open
  # Run tests in headless mode
  npx cypress run
  ```

For more information about test implementation, mocking strategies (especially for Auth0), and best practices, see [./TESTS.md](./TESTS.md).
