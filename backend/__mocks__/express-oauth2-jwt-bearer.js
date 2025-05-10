// Manual mock for express-oauth2-jwt-bearer
// Jest will use this mock automatically when jest.mock('express-oauth2-jwt-bearer') is called

const mockAuth = jest.fn().mockImplementation(() => {
  // By default, pass through middleware that simulates successful authentication
  // This will be overridden in individual tests using setupSuccessfulAuth or setupFailedAuth
  return (req, res, next) => {
    // The default implementation does nothing - will be set by test utilities
    next();
  };
});

const mockRequiredScopes = jest.fn().mockImplementation(requiredScopes => {
  return (req, res, next) => next();
});

const mockClaimEquals = jest.fn().mockImplementation((claim, value) => {
  return (req, res, next) => next();
});

// Export the mock functions directly and also as properties
// so they can be accessed in tests for manipulation
module.exports = {
  auth: mockAuth,
  requiredScopes: mockRequiredScopes,
  claimEquals: mockClaimEquals,
  // Export the functions themselves so tests can manipulate them
  _mockAuth: mockAuth,
  _mockRequiredScopes: mockRequiredScopes,
  _mockClaimEquals: mockClaimEquals
}; 