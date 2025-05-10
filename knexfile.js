// Load environment variables from .env
require('dotenv').config();

// Database configuration object
module.exports = {
  // Development environment
  development: {
    client: 'pg',
    // When running inside the 'migrate' Docker container, DATABASE_URL is set by docker-compose
    // to use the 'postgres' service name.
    // When running knex locally (e.g. for creating migrations), it would use .env-loaded DATABASE_URL or individual vars.
    connection: process.env.DATABASE_URL || { 
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'rsu_db'
    },
    migrations: {
      directory: './database/migrations'
    },
    seeds: {
      directory: './database/seeds'
    }
  },
  
  // Test environment (for running tests)
  test: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10), // Ensure port is integer
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME_TEST || 'uniquedb456' // Ensure this matches .env
    },
    migrations: {
      directory: './database/migrations'
    },
    seeds: {
      directory: './database/seeds/test'
    }
  },
  
  // Production environment
  production: {
    client: 'pg',
    connection: process.env.DATABASE_URL || {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432', 10), // Ensure port is integer
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: { rejectUnauthorized: false }
    },
    migrations: {
      directory: './database/migrations'
    },
    seeds: {
      directory: './database/seeds/production'
    },
    pool: {
      min: 2,
      max: 10
    }
  }
};
