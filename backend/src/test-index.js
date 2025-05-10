// Modified version of index.js for testing
require('dotenv').config({ path: '../.env' }); // Load environment variables from root .env file

const express = require('express');
const cors = require('cors');
const { pool } = require('./config/db');
const logger = require('./config/logger');
const { checkJwt, syncUser, authorizeRole } = require('./middleware/auth');

// Import only the routes we need for testing
const tenantRoutes = require('./routes/tenant');
const userRoutes = require('./routes/user');
const poolRoutes = require('./routes/pool');
const ppsRoutes = require('./routes/pps');
const constantsRoutes = require('./routes/constants');
const mockRoutes = require('./routes/mock');

// Mock the problematic routes with empty routers
const employeeRoutes = express.Router();
const grantRoutes = express.Router();

const app = express();
const port = process.env.BACKEND_PORT || 3001;

// Test DB connection (uses imported pool)
pool.connect((err, client, release) => {
  if (err) {
    return logger.error('Error acquiring database client during initial connect', { error: err.stack });
  }
  client.query('SELECT NOW()', (err, result) => {
    release(); // Release client back to pool
    if (err) {
      return logger.error('Error executing initial test query', { error: err.stack });
    }
    logger.info('Database connected successfully (initial test).');
  });
});

// --- Global Middleware ---
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080'; 
app.use(cors({
  origin: frontendUrl,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Authorization", 
    "Content-Type", 
    "X-Requested-With", 
    "Accept", 
    "Origin",
  ],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

app.use(express.json());

// Basic Request Logging Middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`, { ip: req.ip });
  next();
});

// --- API Routes ---
app.get('/', (req, res) => {
  res.send('RSU/ESOP Platform Backend API');
});

app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    data: { 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'RSU/ESOP Platform API'
    } 
  });
});

app.use('/api', mockRoutes);

app.use('/api', checkJwt, syncUser);

app.use('/api/tenant', tenantRoutes);
app.use('/api/users', userRoutes);
app.use('/api/pools', poolRoutes);
app.use('/api/pps', ppsRoutes);
app.use('/api/constants', constantsRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/grants', grantRoutes);

// --- Error Handling ---
app.use((err, req, res, next) => {
  logger.error(err.message, { stack: err.stack, url: req.originalUrl, method: req.method, ip: req.ip });

  const errorResponse = {
    success: false,
    error: {
        code: err.code || 'INTERNAL_SERVER_ERROR',
        message: err.message || 'An unexpected error occurred.'
    }
  };

  const statusCode = typeof err.status === 'number' ? err.status : 500;

  res.status(statusCode).json(errorResponse);
});

// Start the server only if this file is run directly
if (require.main === module) {
  app.listen(port, () => {
    logger.info(`Backend server listening on port ${port}`);
  });
}

module.exports = app; 