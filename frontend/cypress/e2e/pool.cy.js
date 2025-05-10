/**
 * End-to-End tests for the Equity Pool functionality
 * Tests the complete user flow for viewing and managing equity pools
 */

// Define the base URLs
const apiUrl = Cypress.env('apiUrl') || 'http://localhost:3001';
const frontendUrl = Cypress.env('frontendUrl') || 'http://localhost:8080';

// Tenant ID from the specification
const TENANT_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

describe('Equity Pool Management', () => {
  beforeEach(() => {
    // Reset database state via API before each test
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/test/reset-db`,
      failOnStatusCode: false
    }).then(() => {
      // Visit the home page
      cy.visit('/');
      
      // Mock Auth0 login as an admin user
      cy.mockAuth0Login('admin');
    });
  });
  
  it('should display equity pool details on the dashboard', () => {
    // Navigate to the pools page
    cy.visit('/pool');
    
    // Verify the pool information is displayed
    cy.contains('Equity Pool').should('be.visible');
    cy.contains('Total Pool').should('be.visible');
    cy.contains('Granted Shares').should('be.visible');
    cy.contains('Returned Shares').should('be.visible');
    cy.contains('Available Shares').should('be.visible');
    
    // Verify we have numeric values with proper formatting (3 decimal places)
    cy.get('[data-testid="total-pool"]').invoke('text').should('match', /\d+\.\d{3}/);
    cy.get('[data-testid="available-shares"]').invoke('text').should('match', /\d+\.\d{3}/);
  });
  
  it('should allow admins to add a top-up event', () => {
    // Login as admin and navigate to pool events page
    cy.mockAuth0Login('admin');
    cy.visit('/pool/events');
    
    // Click the "Add Event" button
    cy.contains('Add Event').click();
    
    // Fill out the form for a top-up event
    cy.get('[data-testid="event-type"]').select('top_up');
    cy.get('[data-testid="amount"]').type('500.000');
    cy.get('[data-testid="effective-date"]').type('2025-05-10');
    cy.get('[data-testid="notes"]').type('Additional shares for new hires');
    
    // Submit the form
    cy.get('[data-testid="submit-event"]').click();
    
    // Verify success message
    cy.contains('Event added successfully').should('be.visible');
    
    // Verify the new event appears in the list
    cy.contains('500.000').should('be.visible');
    cy.contains('top_up').should('be.visible');
    cy.contains('Additional shares for new hires').should('be.visible');
    
    // Verify total pool amount has increased
    cy.get('[data-testid="total-pool"]').invoke('text').then((totalText) => {
      // Parse the numeric value - need to handle currency symbol if present
      const totalValue = parseFloat(totalText.replace(/[^0-9.]/g, ''));
      expect(totalValue).to.be.at.least(500); // Should include our top-up amount
    });
  });
  
  it('should prevent employees from adding pool events', () => {
    // Login as employee
    cy.mockAuth0Login('employee');
    cy.visit('/pool/events');
    
    // The "Add Event" button should not be visible for employees
    cy.contains('Add Event').should('not.exist');
    
    // Try to access the form directly via URL
    cy.visit('/pool/events/new');
    
    // Should be redirected or shown access denied
    cy.contains('Access Denied').should('be.visible');
  });
  
  it('should display previous pool events with pagination', () => {
    // Login as admin and seed multiple events via API
    cy.mockAuth0Login('admin');
    
    // Create multiple events via API to test pagination
    // This would call a specific test endpoint that quickly creates many events
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/test/seed-pool-events`,
      body: {
        count: 15, // Create 15 events to test pagination
        tenant_id: TENANT_ID
      },
      failOnStatusCode: false
    });
    
    // Visit the pool events page
    cy.visit('/pool/events');
    
    // Verify we have pagination controls if more than 10 items
    cy.get('[data-testid="pagination"]').should('be.visible');
    
    // Verify initial page shows 10 events
    cy.get('[data-testid="event-row"]').should('have.length', 10);
    
    // Go to next page
    cy.get('[data-testid="next-page"]').click();
    
    // Verify second page shows remaining events (5 more)
    cy.get('[data-testid="event-row"]').should('have.length', 5);
  });
});
