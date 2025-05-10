const { Pool } = require('pg');
const logger = require('./logger');

let pool;

if (process.env.NODE_ENV === 'test') {
  const dbName = process.env.DB_NAME_TEST || 'kiwi3_test';
  logger.info(`Running in test mode, attempting to use database: ${dbName}`);
  
  const testPoolConfig = {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: dbName,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432', 10),
  };

  logger.info('Test Pool Config:', testPoolConfig);

  pool = new Pool(testPoolConfig);
} else {
  // Ensure DATABASE_URL is set in your .env file for non-test environments
  if (!process.env.DATABASE_URL) {
    logger.error('DATABASE_URL environment variable is not set for non-test environment.');
    process.exit(1); // Exit if DATABASE_URL is crucial and not set
  }
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Add SSL config for production if needed
    // ssl: { rejectUnauthorized: false }
  });
}

// Optional: Test DB connection here too, or rely on initial test in index.js
pool.on('connect', (client) => {
  // Log the database name the client is connected to for clarity
  logger.info(`New client connected to database: ${client.database}`);
});

pool.on('error', (err, client) => {
  logger.error('Unexpected error on idle client in database pool', { error: err.stack });
  // process.exit(-1); // Decide if you want to crash on pool errors
});

module.exports = { pool }; 