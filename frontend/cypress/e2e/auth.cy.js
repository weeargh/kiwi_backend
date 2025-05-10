/**
 * Auth0 Login Flow Test
 * 
 * IMPORTANT NOTES ON AUTH0 TESTING:
 * 
 * 1. Cross-Origin Challenge:
 *    Testing Auth0 is complex because it involves a redirect to auth0.com (cross-origin),
 *    which requires Cypress's cy.origin() command to handle.
 * 
 * 2. Setup Requirements:
 *    - cypress.env.json must contain Auth0 test credentials (see below)
 *    - Auth0 tenant must have a test user with appropriate permissions
 *    - Use a dedicated test account, NEVER use production credentials
 * 
 * 3. Alternatives to direct Auth0 testing:
 *    - For most tests: Mock Auth0 and test with pre-authenticated state
 *    - Consider Auth0's testing guide: https://auth0.com/docs/secure/tokens/access-tokens/validate-access-tokens
 * 
 * Example cypress.env.json:
 * {
 *   "AUTH0_USERNAME": "test-user@example.com",
 *   "AUTH0_PASSWORD": "your-secure-password"
 * }
 */

describe('Auth0 Login Flow', () => {
  // It's best practice to store sensitive credentials as environment variables
  // and access them via Cypress.env()
  // Example: CYPRESS_AUTH0_USERNAME, CYPRESS_AUTH0_PASSWORD
  const username = Cypress.env('AUTH0_USERNAME');
  const password = Cypress.env('AUTH0_PASSWORD');
  const auth0Domain = 'dev-g2zz8hnl52wabo01.us.auth0.com'; // Your Auth0 domain

  beforeEach(() => {
    // Using cy.session to cache the login state can speed up tests,
    // but for an explicit login test, we might want to log in fresh each time.
    // For now, we'll log in fresh. Consider cy.session for other tests that need a logged-in state.
    // cy.clearCookies(); // Example: if cookies are used for session
    // cy.clearLocalStorage(); // Example: if localStorage is used for session
  });

  it('should allow a user to log in via Auth0 and see the dashboard', () => {
    // Ensure credentials are provided via environment variables
    if (!username || !password) {
      throw new Error('AUTH0_USERNAME and AUTH0_PASSWORD must be set as Cypress environment variables');
    }

    // 1. Visit your application
    cy.visit('/');

    // 2. Trigger the login process in your application (Click "Log In" button)
    cy.contains('button', 'Log In', { matchCase: false }).click(); // Assuming 'Log In' is button text, case-insensitive

    // 3. Handle the Auth0 login page using cy.origin()
    cy.origin(auth0Domain, { args: { username, password } }, ({ username, password }) => {
      // Verify we are on the Auth0 page (optional, but good for context)
      cy.contains('Log in to Kiwi Equity to continue to Kiwi.').should('be.visible');

      // Find and type into the email/username field
      // Using a robust selector for common email input patterns.
      // Verify with Cypress Selector Playground if this fails.
      cy.get('input[name="email"], input[type="email"], input[placeholder*="Email address"]').first().type(username, { log: false });
      
      // Find and type into the password field
      // Verify with Cypress Selector Playground if this fails.
      cy.get('input[name="password"], input[type="password"], input[placeholder*="Password"]').first().type(password, { log: false });
      
      // Find and click the login/submit button
      cy.contains('button[type="submit"], button', 'Continue', { matchCase: false }).click();
    });

    // 4. Assert that the user is redirected back to your application
    cy.url().should('not.include', auth0Domain);
    cy.url().should('include', Cypress.config('baseUrl')); // Should be back on your app's domain

    // 5. Assert that the user is now logged in and sees the dashboard
    cy.contains('Dashboard', { matchCase: false }).should('be.visible');
    
    // Assuming the username or a welcome message is displayed
    // Adjust according to your actual UI
    cy.get('[data-cy="user-info"]').should('be.visible');
  });
}); 