/**
 * Test suite for auth middleware
 * Tests checkJwt, syncUser, and authorizeRole middlewares
 */

// Import the actual auth middleware - not the mock
const { checkJwt, syncUser, authorizeRole } = require('./auth');

// Import the database helper for transaction support
const DbTestHelper = require('../__tests__/db-test-helper');
const dbHelper = new DbTestHelper();

// Import constants and test utilities
const { MOCK_TENANT_ID } = require('../__tests__/test-utils');
const { v4: uuidv4 } = require('uuid');

// Mock dependencies used in the auth middleware
jest.mock('express-oauth2-jwt-bearer', () => ({
  auth: jest.fn(() => (req, res, next) => {
    // This simulates successful JWT validation by default
    next();
  }),
  requiredScopes: jest.fn(),
  claimEquals: jest.fn()
}));

jest.mock('../config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Mock the db pool to isolate tests from actual database
jest.mock('../config/db', () => ({
  pool: {
    query: jest.fn()
  }
}));

// Get the mocked db pool
const { pool } = require('../config/db');

describe('Auth Middleware', () => {
  // Setup for each test
  let req, res, next;
  
  beforeEach(() => {
    // Start a transaction to isolate database changes
    // This won't actually connect to the database since we've mocked the pool
    // But it keeps the test pattern consistent
    dbHelper.startTransaction();
    
    // Reset req, res, and next for each test
    req = {
      auth: {
        payload: {
          sub: 'auth0|testuser123',
          'https://api.domain.com/tenant_id': MOCK_TENANT_ID,
          'https://api.domain.com/roles': 'admin',
          'https://api.domain.com/email': 'test@example.com',
          'https://api.domain.com/name': 'Test User'
        }
      }
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    next = jest.fn();
    
    // Reset mock function calls
    pool.query.mockReset();
  });
  
  afterEach(async () => {
    // Roll back transaction to maintain test isolation
    await dbHelper.rollbackTransaction();
  });
  
  describe('syncUser middleware', () => {
    it('should find an existing user and add it to the request', async () => {
      // Mock database responses
      const mockUser = {
        user_id: uuidv4(),
        tenant_id: MOCK_TENANT_ID,
        auth0_user_id: 'auth0|testuser123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
        status: 'active'
      };
      
      // Mock the database queries
      pool.query
        // First query checks for deleted users
        .mockResolvedValueOnce({ rows: [] })
        // Second query finds existing user
        .mockResolvedValueOnce({ rows: [mockUser] });
      
      // Call the middleware
      await syncUser(req, res, next);
      
      // Verify user was added to request
      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe(mockUser.user_id);
      expect(req.user.tenantId).toBe(mockUser.tenant_id);
      expect(req.user.auth0Id).toBe(mockUser.auth0_user_id);
      expect(req.user.role).toBe(mockUser.role);
    });
    
    it('should create a new user if one does not exist', async () => {
      const newUserId = uuidv4();
      
      // Mock the database queries
      pool.query
        // First query checks for deleted users
        .mockResolvedValueOnce({ rows: [] })
        // Second query finds no existing user
        .mockResolvedValueOnce({ rows: [] })
        // Third query checks for user with same email
        .mockResolvedValueOnce({ rows: [] })
        // Fourth query creates the new user
        .mockResolvedValueOnce({
          rows: [{ 
            user_id: newUserId,
            status: 'active' 
          }]
        });
      
      // Call the middleware
      await syncUser(req, res, next);
      
      // Verify user was created and added to request
      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe(newUserId);
      expect(req.user.tenantId).toBe(MOCK_TENANT_ID);
      expect(req.user.auth0Id).toBe('auth0|testuser123');
      expect(req.user.role).toBe('admin');
      
      // Verify the correct INSERT query was called
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringMatching(/INSERT INTO user_accounts/),
        expect.arrayContaining([
          MOCK_TENANT_ID,
          'auth0|testuser123',
          'test@example.com',
          'Test User',
          'admin',
          'active'
        ])
      );
    });
    
    it('should return 401 if auth payload is missing', async () => {
      // Remove auth payload
      req.auth = null;
      
      // Call the middleware
      await syncUser(req, res, next);
      
      // Verify error response
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'UNAUTHORIZED'
          })
        })
      );
    });
    
    it('should deny access to a deleted user', async () => {
      // Mock a deleted user response
      pool.query
        .mockResolvedValueOnce({
          rows: [{ user_id: uuidv4() }] // Deleted user exists
        });
      
      // Call the middleware
      await syncUser(req, res, next);
      
      // Verify error response
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'FORBIDDEN'
          })
        })
      );
    });
    
    it('should deny access if the user is inactive', async () => {
      // Mock an inactive user response
      pool.query
        .mockResolvedValueOnce({ rows: [] }) // No deleted user
        .mockResolvedValueOnce({
          rows: [{
            user_id: uuidv4(),
            tenant_id: MOCK_TENANT_ID,
            auth0_user_id: 'auth0|testuser123',
            email: 'test@example.com',
            name: 'Test User',
            role: 'admin',
            status: 'inactive' // User is inactive
          }]
        });
      
      // Call the middleware
      await syncUser(req, res, next);
      
      // Verify error response
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'FORBIDDEN',
            message: expect.stringContaining('inactive')
          })
        })
      );
    });
    
    it('should update existing user with matching email but no Auth0 ID', async () => {
      const existingUserId = uuidv4();
      
      // Mock database responses for email-based user lookup
      pool.query
        .mockResolvedValueOnce({ rows: [] }) // No deleted user
        .mockResolvedValueOnce({ rows: [] }) // No user with matching Auth0 ID
        .mockResolvedValueOnce({
          rows: [{ user_id: existingUserId }] // User with matching email exists
        })
        .mockResolvedValueOnce({ rows: [] }) // Update user query (no return needed)
        .mockResolvedValueOnce({
          rows: [{
            user_id: existingUserId,
            tenant_id: MOCK_TENANT_ID,
            auth0_user_id: 'auth0|testuser123', // Now has Auth0 ID
            email: 'test@example.com',
            name: 'Test User',
            role: 'admin',
            status: 'active'
          }]
        });
      
      // Call the middleware
      await syncUser(req, res, next);
      
      // Verify user was updated and added to request
      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe(existingUserId);
      
      // Verify the update query was called
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE user_accounts/),
        expect.arrayContaining([
          'auth0|testuser123', // Auth0 ID
          existingUserId // User ID
        ])
      );
    });
  });
  
  describe('authorizeRole middleware', () => {
    beforeEach(() => {
      // Set up request with user for authorizeRole tests
      req.user = {
        id: uuidv4(),
        tenantId: MOCK_TENANT_ID,
        auth0Id: 'auth0|testuser123',
        role: 'admin'
      };
    });
    
    it('should allow access with correct role (string)', () => {
      // Create middleware with required role
      const middleware = authorizeRole('admin');
      
      // Call the middleware
      middleware(req, res, next);
      
      // Verify successful authorization
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
    
    it('should allow access with correct role (array)', () => {
      // User has admin role
      req.user.role = 'admin';
      
      // Create middleware with array of roles
      const middleware = authorizeRole(['admin', 'manager']);
      
      // Call the middleware
      middleware(req, res, next);
      
      // Verify successful authorization
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
    
    it('should deny access with incorrect role', () => {
      // User has employee role
      req.user.role = 'employee';
      
      // Create middleware requiring admin role
      const middleware = authorizeRole('admin');
      
      // Call the middleware
      middleware(req, res, next);
      
      // Verify failed authorization
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'FORBIDDEN'
          })
        })
      );
    });
    
    it('should deny access if user information is missing', () => {
      // Remove user from request
      delete req.user;
      
      // Create middleware with required role
      const middleware = authorizeRole('admin');
      
      // Call the middleware
      middleware(req, res, next);
      
      // Verify error response
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'FORBIDDEN'
          })
        })
      );
    });
  });
});