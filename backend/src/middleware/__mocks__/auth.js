// backend/src/middleware/__mocks__/auth.js

// Default tenant ID that matches the one seeded in our test database
const MOCK_TENANT_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

// This middleware simulates the checkJwt middleware from express-oauth2-jwt-bearer
// By default it simulates a successful auth
const mockCheckJwt = jest.fn((req, res, next) => {
  // Add mock JWT payload to req.auth
  req.auth = {
    payload: {
      sub: 'auth0|testuser123',
      'https://api.domain.com/tenant_id': MOCK_TENANT_ID,
      'https://api.domain.com/roles': ['admin'],
      'https://api.domain.com/email': 'testuser@example.com',
      'https://api.domain.com/name': 'Test User'
    }
  };
  next();
});

// Configure mockCheckJwt to simulate authentication failure
mockCheckJwt.simulateAuthFailure = (code = 'UNAUTHORIZED') => {
  mockCheckJwt.mockImplementation((req, res, next) => {
    return res.status(401).json({
      success: false,
      error: { code, message: 'Authentication failed' }
    });
  });
};

// Reset the mockCheckJwt implementation to default (success)
mockCheckJwt.resetToSuccess = () => {
  mockCheckJwt.mockImplementation((req, res, next) => {
    req.auth = {
      payload: {
        sub: 'auth0|testuser123',
        'https://api.domain.com/tenant_id': MOCK_TENANT_ID,
        'https://api.domain.com/roles': ['admin'],
        'https://api.domain.com/email': 'testuser@example.com',
        'https://api.domain.com/name': 'Test User'
      }
    };
    next();
  });
};

// This middleware simulates the syncUser middleware that adds user info from the database
const mockSyncUser = jest.fn((req, res, next) => {
  // Only proceed if we have auth data from mockCheckJwt
  if (!req.auth || !req.auth.payload) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Auth payload missing after JWT check' }
    });
  }
  
  // Add mock user to req.user based on the JWT payload
  req.user = {
    id: 'test-user-id-123',
    tenantId: req.auth.payload['https://api.domain.com/tenant_id'],
    auth0Id: req.auth.payload.sub,
    role: req.auth.payload['https://api.domain.com/roles'][0],
    email: req.auth.payload['https://api.domain.com/email'],
    name: req.auth.payload['https://api.domain.com/name']
  };
  
  next();
});

// Factory function that returns a middleware for role-based authorization
const mockAuthorizeRole = jest.fn((requiredRole) => {
  return (req, res, next) => {
    // Check if user is set and has the required role
    if (!req.user) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'User information missing for authorization' }
      });
    }
    
    const userRole = req.user.role;
    const hasRole = Array.isArray(requiredRole)
      ? requiredRole.includes(userRole)
      : userRole === requiredRole;
      
    if (!hasRole) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' }
      });
    }
    
    next();
  };
});

module.exports = {
  checkJwt: mockCheckJwt,
  syncUser: mockSyncUser,
  authorizeRole: mockAuthorizeRole,
  MOCK_TENANT_ID
}; 