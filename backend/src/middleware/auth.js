const { auth, requiredScopes, claimEquals } = require('express-oauth2-jwt-bearer');
const logger = require('../config/logger');

// Auth0 configuration from environment variables
const auth0Domain = process.env.AUTH0_DOMAIN;
const auth0Audience = process.env.AUTH0_AUDIENCE;

// Custom claim names expected from Auth0 token
const tenantIdClaim = 'https://api.domain.com/tenant_id';
const roleClaim = 'https://api.domain.com/roles';
const emailClaim = 'https://api.domain.com/email'; // Added for namespaced email
const nameClaim = 'https://api.domain.com/name';   // Added for namespaced name

if (!auth0Domain || !auth0Audience) {
  logger.error('CRITICAL: AUTH0_DOMAIN or AUTH0_AUDIENCE not set in environment variables.');
  // In a real production environment, you might want to exit the process
  // process.exit(1);
}

// Authentication middleware: Checks for a valid Auth0 access token
// Uses the audience and domain from environment variables
const checkJwt = auth({
  audience: auth0Audience,
  issuerBaseURL: `https://${auth0Domain}/`,
  tokenSigningAlg: 'RS256'
});

/**
 * Middleware to extract user info from Auth0 token and attach to req.user.
 * Also finds or creates the corresponding user in the local database.
 * MUST run AFTER checkJwt.
 */
const syncUser = async (req, res, next) => {
  // req.auth is populated by the checkJwt middleware
  if (!req.auth || !req.auth.payload || !req.auth.payload.sub) {
    logger.error('Auth payload missing after JWT check. Ensure checkJwt runs first.');
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid authentication payload' } });
  }

  const auth0UserId = req.auth.payload.sub; // Auth0 unique user ID
  
  // Extract custom claims using the defined names
  const tenantId = req.auth.payload[tenantIdClaim];
  const roles = req.auth.payload[roleClaim]; // Assume roles might be an array
  const role = Array.isArray(roles) ? roles[0] : roles; // Take the first role if it's an array

  // Extract namespaced email and name
  const email = req.auth.payload[emailClaim];
  const name = req.auth.payload[nameClaim];

  // Validate that custom claims were found in the token
  if (!tenantId) {
    logger.error(`Could not determine tenantId for Auth0 user ${auth0UserId} using claim '${tenantIdClaim}'`);
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Tenant information missing in token' } });
  }
  if (!role) {
    logger.error(`Could not determine role for Auth0 user ${auth0UserId} using claim '${roleClaim}'`);
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Role information missing in token' } });
  }

  // Import the pool from the dedicated db config file
  const { pool } = require('../config/db');

  try {
    // First, check if this Auth0 ID belongs to a deleted user
    const deletedUserCheck = await pool.query(
      'SELECT user_id FROM user_accounts WHERE auth0_user_id = $1 AND tenant_id = $2 AND deleted_at IS NOT NULL',
      [auth0UserId, tenantId]
    );
    
    // If this Auth0 ID belongs to a deleted user, deny access
    if (deletedUserCheck.rows.length > 0) {
      logger.warn(`Access denied for deleted user with Auth0 ID: ${auth0UserId}`);
      return res.status(403).json({ 
        success: false, 
        error: { 
          code: 'FORBIDDEN', 
          message: 'User account has been deleted from this application' 
        }
      });
    }
    
    // Try to find active user by auth0_user_id and tenant_id
    let userResult = await pool.query(
      'SELECT user_id, tenant_id, auth0_user_id, email, name, role, status FROM user_accounts WHERE auth0_user_id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
      [auth0UserId, tenantId]
    );
    let user = userResult.rows[0];

    if (!user) {
      // Check if a user with this email exists but without Auth0 ID (invitation scenario)
      if (email) {
        const emailUserResult = await pool.query(
          'SELECT user_id FROM user_accounts WHERE email = $1 AND tenant_id = $2 AND auth0_user_id IS NULL AND deleted_at IS NULL',
          [email, tenantId]
        );
        
        // If we found a user with matching email but no Auth0 ID, update it
        if (emailUserResult.rows.length > 0) {
          const emailUserId = emailUserResult.rows[0].user_id;
          logger.info(`Found existing user ${emailUserId} with matching email ${email}. Linking to Auth0 ID ${auth0UserId}`);
          
          // Update the existing user with the Auth0 ID
          await pool.query(
            'UPDATE user_accounts SET auth0_user_id = $1 WHERE user_id = $2',
            [auth0UserId, emailUserId]
          );
          
          // Fetch the updated user record
          userResult = await pool.query(
            'SELECT user_id, tenant_id, auth0_user_id, email, name, role, status FROM user_accounts WHERE user_id = $1',
            [emailUserId]
          );
          user = userResult.rows[0];
        }
      }
      
      // If still no user, create a new one
      if (!user) {
        // User logged in via Auth0 for the first time for this tenant, create local record
        logger.info(`First login for Auth0 user ${auth0UserId} in tenant ${tenantId}. Creating local record.`);

        // Ensure email and name are present (should come from Auth0 profile)
        if (!email || !name) {
           logger.error(`Cannot create local user for ${auth0UserId}, missing email or name in token.`);
           return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile incomplete in token (missing email or name)' } });
        }

        // Insert the new user record using data from the token
        const insertResult = await pool.query(
          'INSERT INTO user_accounts (tenant_id, auth0_user_id, email, name, role, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING user_id, status',
          [tenantId, auth0UserId, email, name, role, 'active'] // Default status to active
        );
        user = {
          user_id: insertResult.rows[0].user_id,
          tenant_id: tenantId,
          auth0_user_id: auth0UserId,
          email: email,
          name: name,
          role: role,
          status: insertResult.rows[0].status
        };
        logger.info(`Created local user record ${user.user_id} for Auth0 user ${auth0UserId}`);
      }
    }

    // Check application-level status (e.g., if admin manually deactivated them)
    if (user.status !== 'active') {
      logger.warn(`Access denied for inactive application user: ${user.user_id} (Auth0 ID: ${auth0UserId})`);
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'User account is inactive in this application' } });
    }

    // Attach necessary user info to req.user for downstream route handlers
    req.user = {
      id: user.user_id,
      tenantId: user.tenant_id,
      auth0Id: user.auth0_user_id,
      role: user.role,
    };

    logger.info(`User Synced: AppUserID=${req.user.id}, Auth0ID=${req.user.auth0Id}, TenantID=${req.user.tenantId}, Role=${req.user.role}`);
    next(); // Proceed to the next middleware or route handler

  } catch (error) {
    logger.error(`Database error syncing user ${auth0UserId}: ${error.message}`, { stack: error.stack });
    // Pass the error to the central error handler
    next(error);
  }
};

/**
 * Authorization middleware factory.
 * Checks if the user attached by syncUser has the required role.
 * @param {string | string[]} requiredRole - The role(s) required (e.g., 'admin', ['admin', 'manager']).
 */
const authorizeRole = (requiredRole) => {
  return (req, res, next) => {
    // Ensure syncUser middleware ran successfully and populated req.user
    if (!req.user || !req.user.role) {
      logger.error('Authorization check failed: req.user not populated. Ensure syncUser middleware runs before authorizeRole.');
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'User information incomplete or missing for authorization' } });
    }

    const userRole = req.user.role;
    const hasRequiredRole = Array.isArray(requiredRole)
      ? requiredRole.includes(userRole)
      : userRole === requiredRole;

    if (!hasRequiredRole) {
      logger.warn(`Authorization failed: User ${req.user.id} (Role: ${userRole}) attempted action requiring role(s): ${requiredRole}`);
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions for this action' } });
    }

    logger.debug(`Authorization successful for User ${req.user.id} (Role: ${userRole}) for roles: ${requiredRole}`);
    next(); // User has the required role(s), proceed
  };
};

/**
 * Convenience middleware for checking admin role.
 * Uses the authorizeRole middleware factory with 'admin' as the required role.
 */
const checkRoleAdmin = authorizeRole('admin');

// Example for checking specific permissions if using Auth0 RBAC scopes
// const checkPermissions = (requiredPermissions) => requiredScopes(requiredPermissions);

module.exports = {
  checkJwt,
  syncUser,
  authorizeRole,
  checkRoleAdmin,  // Export the new middleware
  // checkPermissions, // Uncomment and export if using scope-based permissions
}; 