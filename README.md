# RSU/ESOP Platform (Kiwi3)

This repository contains the source code for the RSU/ESOP management platform specified in `SPECIFICATION.md` and `api.yml`.

## Project Structure

- `backend/`: Node.js (Express) API server.
- `frontend/`: Vue 3 (PrimeVue) web application.
- `database/`: PostgreSQL database migration scripts and configuration (`node-pg-migrate`).
- `SPECIFICATION.md`: Functional and technical specification.
- `api.yml`: OpenAPI (v3) specification for the backend API.
- `docker-compose.yml`: Docker configuration for local development environment.
- `.env.example`: Example environment variables required.

## Prerequisites

- Docker & Docker Compose
- Node.js (v18 or later recommended for consistency)
- npm

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
    This command will build the Docker images (if they don't exist) and start the `postgres`, `backend`, and `frontend` services.
    ```bash
    docker-compose up --build -d
    ```
    *   `-d` runs the services in detached mode.
    *   `--build` forces a rebuild of the images.

4.  **Run Database Migrations:**
    Execute the migration scripts inside the running `backend` container (which has access to the database service).
    ```bash
    docker-compose exec backend npm run migrate --prefix ./database up
    ```
    *   `--prefix ./database` tells npm to run the script from the `database` package context.
    *   `up` applies all pending migrations.

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
*   **Database Migrations:**
    *   Create a new migration: `docker-compose exec backend npm run migrate:create --prefix ./database -- <migration_name>`
    *   Run migrations: `docker-compose exec backend npm run migrate --prefix ./database up`
    *   Rollback migrations: `docker-compose exec backend npm run migrate --prefix ./database down`

## Stopping Services

```bash
docker-compose down
```
To remove volumes (including database data): `docker-compose down -v`

## Next Steps (Stage 1)

Proceed with implementing Stage 1: Core Identity & Tenant Management. 