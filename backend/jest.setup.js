/**
 * Jest setup file that runs after Jest is loaded but before tests
 * See the "setupFilesAfterEnv" configuration in package.json
 */

// Ensure NODE_ENV is set to 'test' for all tests
process.env.NODE_ENV = 'test';

// Suppress console.log, warn, error during tests unless debugging is enabled
// Uncomment these lines to silence console output during tests
/*
if (!process.env.DEBUG) {
  global.console.log = jest.fn();
  global.console.warn = jest.fn();
  global.console.error = jest.fn();
}
*/

// Set a timeout of 10 seconds for all tests
jest.setTimeout(10000);

// Additional setup could go here:
// - Global test hooks
// - Custom jest matchers
// - Mock storage setup/cleanup 
