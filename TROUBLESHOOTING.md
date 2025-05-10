# Troubleshooting Guide for Kiwi3 RSU/ESOP Platform

## Error: "Unexpected data structure: undefined"

### Issue
The application was showing a JavaScript error: "Unexpected data structure: undefined" in the PPS history display and potentially other components.

### Root Cause
The error occurred because the API response handling in the frontend components didn't properly account for different response formats. The frontend's Axios interceptor sometimes extracts the `data` field from responses with `success: true`, but this behavior wasn't consistent across all components.

### Solution
1. Modified the `fetchPPSHistory` function in `frontend/src/components/PPSManagement.vue` and the `fetchPoolEvents` function in `frontend/src/components/PoolManagement.vue` to handle different API response structures:

```javascript
if (result && result.data && result.data.items) {
  ppsHistory.value = result.data.items;
  totalPPSEntries.value = result.data.pagination.total_items;
} else if (result && result.items) {
  ppsHistory.value = result.items;
  totalPPSEntries.value = result.pagination.total_items;
} else {
  // Initialize with empty array if no valid data structure
  console.warn('Received unexpected API response structure:', result);
  ppsHistory.value = [];
  totalPPSEntries.value = 0;
}
```

2. Updated the `fetchPoolData` function in `PoolManagement.vue` to properly handle the response from `ppsService.getCurrentPPS()`:

```javascript
// Get the equity pool data
const result = await poolService.getPool();
poolData.value = result.data || result;

// Get the current PPS
try {
  const ppsResult = await ppsService.getCurrentPPS();
  currentPPS.value = ppsResult.data || ppsResult;
} catch (error) {
  // Error handling...
}
```

3. Updated the `fetchUsers` function in `UserManagement.vue` to handle all possible API response formats:

```javascript
const responseData = await apiClient.get('/users'); 
if (responseData && responseData.data && Array.isArray(responseData.data.items)) {
    users.value = responseData.data.items;
} else if (responseData && Array.isArray(responseData.items)) {
    users.value = responseData.items;
} else if (Array.isArray(responseData)) {
    users.value = responseData;
} else {
    console.warn('Unexpected response structure for users list:', responseData);
    users.value = [];
}
```

These changes made the components more resilient to different API response formats.

## Error: "Cannot read properties of undefined (reading 'data')"

### Issue
The application was displaying the error "Cannot read properties of undefined (reading 'data')" when trying to fetch equity pool data and other API resources.

### Root Cause
The issue had multiple causes:

1. **Authentication issues**: The Auth0 authentication was not being properly handled, causing API requests to fail when the authentication token wasn't available.

2. **Inconsistent API response handling**: The API services were accessing `response.data` directly without checking if the response or the data property existed.

3. **Error propagation**: Errors from API services weren't being properly caught and handled, leading to undefined values being passed to components.

### Solution

1. **Improved authentication handling in apiClient.js**:
   - Added better error handling for the Auth0 authentication process
   - Made the interceptor continue with requests even when authentication fails, letting the API return 401 if needed
   - Added proper null/undefined checks for the auth0 instance

```javascript
// apiClient.js request interceptor
try {
  // Check if Auth0 is initialized
  if (!auth0 || !auth0.getAccessTokenSilently) {
    console.error('Auth0 instance is not available or not properly initialized in apiClient.');
    return config; // Continue with the request without token, let the API return 401 if needed
  }

  try {
    const token = await auth0.getAccessTokenSilently({...});
    config.headers.Authorization = `Bearer ${token}`;
  } catch (tokenError) {
    // Handle errors during token acquisition, but don't reject the request
    console.warn('Error getting access token, proceeding without authentication:', tokenError);
  }
  
  return config;
} catch (error) {
  // Handle unexpected errors in the interceptor
  console.error('Unexpected error in request interceptor:', error);
  return config; // Continue with the request
}
```

2. **Safer API service methods**:
   - Updated `poolService.getPool()` and `ppsService.getCurrentPPS()` to safely handle different response formats
   - Added null checks before accessing properties of potentially undefined objects
   - Added detailed error logging

```javascript
// poolService.js getPool method
try {
  const response = await api.get('/pools');
  // Check if response exists and has a data property
  if (response && response.data) {
    return response.data;
  } else if (response) {
    return response;
  } else {
    console.warn('Received empty response from /pools endpoint');
    return null;
  }
} catch (error) {
  console.error('Error fetching pool data:', error);
  throw error;
}
```

3. **More robust component handling**:
   - Updated `PoolManagement.vue` component to check for user authentication before making API calls
   - Added comprehensive null/undefined checks for all API responses
   - Improved error handling to prevent unhandled exceptions

```javascript
// PoolManagement.vue fetchPoolData function
try {
  // Check if user is authenticated
  if (!user.value) {
    console.warn('User is not authenticated when trying to fetch pool data');
    loading.value = false;
    return;
  }

  // Get the equity pool data
  const result = await poolService.getPool();
  
  // Handle different response formats
  if (result && result.data) {
    poolData.value = result.data;
  } else if (result) {
    poolData.value = result;
  } else {
    console.warn('Unexpected or empty response from pool service');
    poolData.value = null;
    return;
  }
  
  // Additional code...
} catch (error) {
  console.error('Error fetching pool data:', error);
  toast.add({ severity: 'error', summary: 'Error', detail: `Failed to load equity pool data: ${error.message}`, life: 5000 });
  poolData.value = null;
}
```

## Database Setup

To ensure the database is properly set up:

1. Confirm that the database migrations have been applied: `SELECT * FROM pgmigrations;`
2. Verify that the equity pool table has been created and populated with data.
3. Check that there's an initial pool event record in the pool_events table.
4. Ensure there's at least one PPS (Price Per Share) record in the pps_history table.

If any of these tables are missing data, you may need to initialize them with appropriate values.

## API Authentication

The API requires proper authentication. If you're experiencing authentication issues:

1. Check that the Auth0 configuration is correct in your environment variables.
2. Verify that the frontend is properly sending the authentication token with API requests.
3. Make sure the JWT token has not expired.

## Building the Frontend

After making changes to the frontend code, you need to rebuild the application:

```bash
cd frontend
npm run build
docker restart rsu_frontend
```

This will compile the Vue.js code and restart the nginx container serving the frontend.

## Backend Tests Failing with DB Connection/Relation Errors (Resolved)

### Symptoms
*   Running `npm test` in the `backend` directory fails during `jest.global-setup.js`.
*   Errors might include: `database "..." does not exist`, `relation "..." does not exist`, `role "..." does not exist`, or `ECONNREFUSED`.
*   Migrations run via `docker-compose up migrate` might fail with errors like `TypeError: Cannot read properties of undefined (reading 'createTable')` or connection errors.

### Root Cause
Mismatch between the intended migration tool (Knex.js, as specified in `PLAN.md` and used in migration files) and the configured tool (`node-pg-migrate`, found in `database/package.json` and `docker-compose.yml`). This led to migrations not running correctly. Additionally, misaligned configurations in `.env`, `knexfile.js`, and `docker-compose.yml` regarding database names (`DB_NAME_TEST`) and connection methods (using `localhost` vs. the Docker service name `postgres`) contributed to connection failures from either the `migrate` service or the host-based Jest tests.

### Resolution Steps
1.  **Standardize on Knex.js:**
    *   Updated `database/package.json` to include `knex` and `pg` dependencies and removed `node-pg-migrate`.
    *   Updated `scripts` in `database/package.json` to use `knex` commands (e.g., `migrate:latest`, `migrate:make`).
2.  **Correct Migration File:** Renamed malformed migration filename `YYYYMMDDHHMMSS_create_audit_logs_table.js` to `1746800000000_create_audit_logs_table.js` to use a valid timestamp prefix compatible with Knex. Ensured migration file uses Knex syntax.
3.  **Update Docker Compose (`docker-compose.yml`):**
    *   Changed the `migrate` service image to `node:20-alpine` for better dependency compatibility.
    *   Updated the `migrate` service command to execute the Knex migration script (`npm run migrate:latest`).
    *   Ensured the `migrate` service `DATABASE_URL` uses the service name `postgres` as the host.
4.  **Align Knex Configuration (`knexfile.js`):**
    *   Modified the `development` environment connection to prioritize `process.env.DATABASE_URL` (provided by Docker Compose to the `migrate` container).
    *   Ensured the `test` environment connection uses `localhost` as the host and the correct `DB_NAME_TEST`.
5.  **Align Environment Variables (`.env`):**
    *   Set `DB_NAME_TEST` to match the database created by the `postgres` service (`POSTGRES_DB` in `docker-compose.yml`, e.g., `uniquedb456`).
    *   Ensured `DB_HOST=localhost` for host-based test connections.
6.  **Reset Environment:** Ran `docker-compose down -v && docker-compose up -d --build` followed by `docker-compose up migrate`.

### Outcome
With these changes, the `migrate` service successfully runs Knex migrations, and backend tests (`cd backend && npm test`) connect to the test database and pass.
