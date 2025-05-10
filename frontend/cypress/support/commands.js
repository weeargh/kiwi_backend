// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })

/**
 * Mock Auth0 login WITHOUT real Auth0 credentials
 * 
 * This command sets up the auth tokens directly in localStorage, bypassing 
 * the actual Auth0 authentication flow. This approach is perfect for E2E
 * tests that need an authenticated state without depending on Auth0's API.
 * 
 * @param {string} role - User role ('admin' or 'employee')
 */
Cypress.Commands.add('mockAuth0Login', (role = 'admin') => {
  // Define default test tenant ID from the specification
  const tenantId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
  const mockUserId = role === 'admin' ? 'auth0|admin-test-123' : 'auth0|employee-test-123';
  const mockUserEmail = `test-${role}@example.com`;
  const mockUserName = `Test ${role.charAt(0).toUpperCase() + role.slice(1)}`;

  cy.log(`Setting up mock Auth0 login for ${role} user`);

  // Create a mock token that our backend will accept
  // This is a fake token - actual validation is mocked on the backend
  const fakeAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  const fakeIdToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJuYW1lIjoidGVzdCIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSJ9.sign';
  const now = new Date();
  const expiresAt = JSON.stringify(now.getTime() + 86400000); // 24 hours from now

  // Create fake user profile with our claims
  const user = {
    sub: mockUserId,
    name: mockUserName,
    email: mockUserEmail,
    'https://api.domain.com/tenant_id': tenantId,
    'https://api.domain.com/roles': role,
    'https://api.domain.com/email': mockUserEmail,
    'https://api.domain.com/name': mockUserName
  };

  // Setup auth state in localStorage
  window.localStorage.setItem('auth0.is.authenticated', 'true');
  window.localStorage.setItem('auth0.access_token', fakeAccessToken);
  window.localStorage.setItem('auth0.id_token', fakeIdToken);
  window.localStorage.setItem('auth0.expires_at', expiresAt);
  window.localStorage.setItem('auth0.user', JSON.stringify(user));

  // Seed the test user in the database
  return cy.request({
    method: 'POST',
    url: Cypress.env('apiUrl') || 'http://localhost:3001',
    failOnStatusCode: false, // Don't fail if endpoint doesn't exist yet
    body: {
      auth0_id: mockUserId,
      tenant_id: tenantId,
      email: mockUserEmail,
      name: mockUserName,
      role: role
    }
  }).then(() => {
    // Force reload the page to ensure the app picks up the authentication state
    cy.reload();
  });
});

/**
 * Custom command: Programmatic Auth0 login with real credentials 
 * 
 * Usage:
 * cy.loginViaAuth0() - Uses environment variables for credentials
 * cy.loginViaAuth0('custom@email.com', 'password123') - Uses provided credentials
 * 
 * This command is useful for tests that need an authenticated state but
 * aren't specifically testing the login flow itself. It provides a more
 * efficient way to log in without simulating UI interactions.
 */
Cypress.Commands.add('loginViaAuth0', (username, password) => {
  // Use provided credentials or fall back to environment variables
  const auth0Username = username || Cypress.env('AUTH0_USERNAME');
  const auth0Password = password || Cypress.env('AUTH0_PASSWORD');
  const auth0Domain = Cypress.env('AUTH0_DOMAIN') || 'dev-g2zz8hnl52wabo01.us.auth0.com';
  const clientId = Cypress.env('AUTH0_CLIENT_ID');
  const audience = Cypress.env('AUTH0_AUDIENCE');
  
  // Ensure we have the required credentials
  if (!auth0Username || !auth0Password || !clientId) {
    throw new Error('Missing Auth0 credentials. Set them in cypress.env.json or provide them as arguments');
  }
  
  // Log in via Auth0 API and set the tokens
  cy.request({
    method: 'POST',
    url: `https://${auth0Domain}/oauth/token`,
    body: {
      grant_type: 'password',
      username: auth0Username,
      password: auth0Password,
      audience: audience,
      scope: 'openid profile email',
      client_id: clientId
    }
  }).then(response => {
    // Store tokens in localStorage as your app would
    const { access_token, id_token, expires_in } = response.body;
    
    // Calculate expiry time
    const expiresAt = JSON.stringify((expires_in * 1000) + new Date().getTime());
    
    // Set up localStorage with Auth0 tokens
    cy.window().then(win => {
      // Adjust these keys based on how your Auth0 integration stores tokens
      win.localStorage.setItem('auth0.access_token', access_token);
      win.localStorage.setItem('auth0.id_token', id_token);
      win.localStorage.setItem('auth0.expires_at', expiresAt);
      
      // Refresh the page to ensure the app picks up the tokens
      cy.reload();
    });
  });
});