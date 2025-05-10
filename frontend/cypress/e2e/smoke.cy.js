/**
 * Smoke Test
 * 
 * This is the most basic test that verifies the application loads correctly.
 * It doesn't require authentication, making it perfect for quick verification
 * that the deployment is working.
 * 
 * For tests that require authentication:
 * 1. Use cy.loginViaAuth0() custom command for programmatic login
 * 2. Or follow the pattern in auth.cy.js for testing the full login flow
 */
describe('Application Smoke Test', () => {
  it('successfully loads the home page and displays initial content', () => {
    cy.visit('/'); // Visits the baseUrl

    // Check if the main body tag exists - a very basic check
    cy.get('body').should('be.visible');

    // Check for specific welcome/login prompt text
    cy.contains('Kiwi3 RSU Platform').should('be.visible');
    cy.contains('Please log in to access the platform.').should('be.visible');
  });
}); 