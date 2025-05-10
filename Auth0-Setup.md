# Auth0 Setup Guide for Kiwi3 RSU Platform

This guide details the necessary steps to configure Auth0 for authentication and authorization for the Kiwi3 RSU Platform. It also covers common troubleshooting steps.

## 1. Auth0 Tenant

Ensure you have an Auth0 tenant. The domain for this tenant will be used in your application configuration (e.g., `dev-xxxxxxxx.us.auth0.com`).

## 2. Auth0 Application (Single Page Application - SPA)

You need to register your frontend as an Application in Auth0.

1.  Go to **Applications -> Applications** in your Auth0 Dashboard.
2.  Click **"Create Application"**.
3.  Choose **"Single Page Web Applications"** as the application type.
4.  Give it a name (e.g., "Kiwi3 Frontend").
5.  After creation, go to the **"Settings"** tab for this application.
6.  Note down the **Domain** and **Client ID**. These will be used as environment variables for your frontend.
7.  Configure the following URLs (adjust ports if your local dev setup differs):
    *   **Allowed Callback URLs**: This is where Auth0 will redirect users after they authenticate.
        *   `http://localhost:8080` (if using the Docker setup where frontend is exposed on 8080)
        *   `http://localhost:5173` (if running Vite dev server directly on default port)
        *   Add URLs for deployed environments (staging, production) as needed.
    *   **Allowed Logout URLs**: This is where Auth0 will redirect users after they log out.
        *   `http://localhost:8080`
        *   `http://localhost:5173`
        *   Add URLs for deployed environments as needed.
    *   **Allowed Web Origins**: URLs from which Auth0 will accept requests.
        *   `http://localhost:8080`
        *   `http://localhost:5173`
        *   Add URLs for deployed environments as needed.
    *   **Allowed Origins (CORS)**: (Usually same as Allowed Web Origins) URLs that can make cross-origin authentication requests.
        *   `http://localhost:8080`
        *   `http://localhost:5173`
8.  Ensure "Token Endpoint Authentication Method" is set to **"None"** (typical for SPAs).
9.  Save changes.

## 3. Auth0 API (Resource Server)

You need to define an API in Auth0 that represents your backend. This API's identifier will be the "Audience" for your tokens.

1.  Go to **Applications -> APIs** in your Auth0 Dashboard.
2.  Click **"Create API"**.
3.  Give it a name (e.g., "Kiwi3 Backend API").
4.  Set an **Identifier**. This will be your API Audience. It's recommended to use an HTTPS URL that you control (even if it doesn't point to a real web page). For example: `https://api.kiwi3rsu.com` or use the Auth0 dev domain like `https://YOUR_AUTH0_DOMAIN/api/v2/`.
    *   We have been using `https://YOUR_AUTH0_DOMAIN/api/v2/` (e.g. `https://dev-g2zz8hnl52wabo01.us.auth0.com/api/v2/`). This value must match `VITE_AUTH0_AUDIENCE` (frontend) and `AUTH0_AUDIENCE` (backend).
5.  The **Signing Algorithm** should be `RS256` (default and recommended).
6.  Save the API. You do not need to configure permissions (scopes) at this stage unless you plan to use fine-grained Auth0 RBAC scopes.

## 4. Auth0 Action for Custom Claims

To provide your backend with necessary user information like `tenant_id` and `role`, create an Auth0 Action that runs after login.

1.  Go to **Actions -> Library** in your Auth0 Dashboard.
2.  Click **"Build Custom"**.
3.  Name your Action (e.g., "Add Custom Claims to Token").
4.  Trigger: **Login / Post Login**.
5.  Runtime: Choose a recent Node.js version.
6.  Paste the following code into the editor:

    ```javascript
    /**
    * Handler that will be called during the execution of a PostLogin flow.
    *
    * @param {Event} event - Details about the user and the context in which they are logging in.
    * @param {PostLoginAPI} api - Interface whose methods can be used to change the behavior of the login flow.
    */
    exports.onExecutePostLogin = async (event, api) => {
      const namespace = 'https://api.domain.com'; // Ensure this exact namespace is used in backend middleware

      // Get tenant_id and role from the user's app_metadata
      const tenantId = event.user.app_metadata?.tenant_id;
      const role = event.user.app_metadata?.role;

      if (tenantId && role) {
        // Add claims to the Access Token (for your backend API)
        api.accessToken.setCustomClaim(`${namespace}/tenant_id`, tenantId);
        api.accessToken.setCustomClaim(`${namespace}/roles`, [role]); // Backend expects roles as an array or takes the first

        // Add claims to the ID Token (useful for frontend if it needs this info)
        api.idToken.setCustomClaim(`${namespace}/tenant_id`, tenantId);
        api.idToken.setCustomClaim(`${namespace}/roles`, [role]);

        console.log(`ACTION LOG: Added custom claims for user ${event.user.user_id}: tenant_id=${tenantId}, role=${role}`);
      } else {
        let missing = [];
        if (!tenantId) missing.push('tenant_id');
        if (!role) missing.push('role');
        console.log(`ACTION LOG WARN: Custom claims NOT added for user ${event.user.user_id}. Missing ${missing.join(' and ')} in app_metadata.`);
        // If these claims are critical, you might deny access:
        // api.access.deny('application_access_denied', 'User is missing required metadata (tenant_id or role).');
      }
    };
    ```

7.  Click **"Deploy"**.
8.  Go to **Actions -> Flows**.
9.  Select the **"Login"** flow.
10. Drag your custom Action from the "Custom" tab into the flow. Ensure it's placed correctly (usually after user authentication steps).

**Crucial Data Point:** For this Action to work, each Auth0 user who needs to access your application **must** have `tenant_id` (as a valid UUID that will match a `tenant_id` in your `tenants` database table) and `role` populated in their **`app_metadata`** within the Auth0 user profile.

Example `app_metadata` for a user in Auth0:
```json
{
  "tenant_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", // A real UUID
  "role": "admin" // Or "employee", etc.
}
```

## 5. Environment Variables

**Frontend (`frontend/.env`):**
```env
VITE_AUTH0_DOMAIN=YOUR_AUTH0_TENANT_DOMAIN (e.g., dev-xxxxxxxx.us.auth0.com)
VITE_AUTH0_CLIENT_ID=YOUR_AUTH0_SPA_CLIENT_ID
VITE_AUTH0_AUDIENCE=YOUR_AUTH0_API_IDENTIFIER (e.g., https://YOUR_AUTH0_TENANT_DOMAIN/api/v2/)
VITE_API_BASE_URL=http://localhost:3001/api (or your backend API URL)
```

**Backend (Project root `.env`, used by `docker-compose.yml`):**
```env
# ... other variables like DB_USER, DB_PASSWORD, etc. ...
AUTH0_DOMAIN=YOUR_AUTH0_TENANT_DOMAIN
AUTH0_AUDIENCE=YOUR_AUTH0_API_IDENTIFIER

# Frontend URL for CORS configuration in backend
FRONTEND_URL=http://localhost:8080
```

## 6. Troubleshooting

*   **"Tenant information missing in token" (403 Forbidden from backend):**
    *   Verify the Auth0 Action is deployed and active in the Login flow.
    *   Check Auth0 monitoring logs. Does the Action log that it's adding claims, or does it log a warning about missing `app_metadata`?
    *   Ensure the user logging in has the correct `tenant_id` and `role` in their **`app_metadata`** (not `user_metadata`) in Auth0.
    *   Ensure the namespace (`https://api.domain.com`) and claim names (`/tenant_id`, `/roles`) in the Action match *exactly* what the backend `syncUser` middleware expects.

*   **"invalid input syntax for type uuid: ..." (500 Internal Server Error from backend):**
    *   This means the `tenant_id` value retrieved from the token (originally from `app_metadata`) is not a valid UUID, but the database column (e.g., `tenants.tenant_id` or `user_accounts.tenant_id`) expects a UUID.
    *   Ensure the `tenant_id` in the user's Auth0 `app_metadata` is a correctly formatted UUID (e.g., `123e4567-e89b-12d3-a456-426614174000`).

*   **CORS Errors (e.g., "No 'Access-Control-Allow-Origin' header")**:
    *   Ensure the `cors` middleware is correctly configured in `backend/src/index.js`.
    *   The `origin` in the CORS configuration must match the URL your frontend is served from (e.g., `http://localhost:8080` as per Docker setup).
    *   Ensure `FRONTEND_URL` environment variable is correctly set for the backend if you use it in `cors` config.

*   **Backend: "Cannot find module '...'":**
    *   Ensure the module (e.g., `cors`, `express-oauth2-jwt-bearer`) is listed in `backend/package.json`.
    *   Ensure `backend/package-lock.json` is up-to-date by running `npm install` in the `kiwi3/backend` directory locally.
    *   Rebuild the Docker image using `docker-compose build --no-cache backend`.
    *   Verify your `backend/Dockerfile` correctly copies `package*.json` and runs `npm install` or `npm ci`.
    *   Check `docker-compose.yml` for correct volume configuration for `node_modules` (e.g., using a named volume like `backend_node_modules:/usr/src/app/backend/node_modules`).

*   **Backend: `ECONNREFUSED` for database connection:**
    *   Ensure the `postgres` service is healthy.
    *   Ensure the `backend` service in `docker-compose.yml` has `depends_on: postgres: condition: service_healthy`.
    *   Verify `DATABASE_URL` for the backend uses the service name `postgres` as the host.

*   **Decoding Access Tokens for Debugging:**
    *   You can copy an Access Token (e.g., from browser dev tools network tab, or logged by `apiClient.js`) and paste it into a JWT debugger like [jwt.io](https://jwt.io/) to inspect its payload and see if the custom claims are present as expected. 