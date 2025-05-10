import { auth0 } from '../main';

/**
 * Service for common authentication-related functionality
 */
const authService = {
  /**
   * Check if the user is currently authenticated
   * @returns {boolean} True if authenticated, false otherwise
   */
  isAuthenticated: () => {
    return !!auth0?.isAuthenticated?.value;
  },

  /**
   * Get the current user profile
   * @returns {Object|null} User profile object or null if not authenticated
   */
  getUserProfile: () => {
    return auth0?.user?.value || null;
  },

  /**
   * Check if the current user has a specific role
   * @param {string|string[]} role - Role or array of roles to check
   * @returns {boolean} True if user has the role, false otherwise
   */
  hasRole: (role) => {
    const user = auth0?.user?.value;
    if (!user) return false;

    const userRoles = user['https://api.domain.com/roles'] || [];
    
    if (Array.isArray(role)) {
      return role.some(r => userRoles.includes(r));
    }
    
    return userRoles.includes(role);
  },

  /**
   * Get the tenant ID for the current user
   * @returns {string|null} Tenant ID or null if not available
   */
  getTenantId: () => {
    const user = auth0?.user?.value;
    if (!user) return null;
    
    return user['https://api.domain.com/tenant_id'] || null;
  },

  /**
   * Format an authentication error for display
   * @param {Error} error - The auth error
   * @returns {Object} Formatted error with title, message, and optionally details
   */
  formatAuthError: (error) => {
    let title = 'Authentication Error';
    let message = 'An error occurred during authentication.';
    let details = '';

    if (error.error === 'login_required') {
      title = 'Login Required';
      message = 'You need to log in to access this feature.';
    } else if (error.error === 'consent_required') {
      title = 'Consent Required';
      message = 'You need to grant permission to this application.';
    } else if (error.error === 'invalid_grant') {
      title = 'Session Expired';
      message = 'Your session has expired. Please log in again.';
    } else if (error.message) {
      message = error.message;
      if (error.description) {
        details = error.description;
      }
    }

    return { title, message, details };
  }
};

export default authService; 