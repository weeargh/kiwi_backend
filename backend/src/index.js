require('dotenv').config({ path: '../.env' }); // Load environment variables from root .env file

const express = require('express');
const cors = require('cors'); // <-- Import cors
const { pool } = require('./config/db'); // Import pool from db.js
const logger = require('./config/logger'); // Import the logger
const { checkJwt, syncUser, authorizeRole } = require('./middleware/auth'); // Import Auth0 middleware

// Import routes
// const authRoutes = require('./routes/auth'); // Removed
const tenantRoutes = require('./routes/tenant');
const userRoutes = require('./routes/user');
// Add other route imports as needed (e.g., employees, pools, grants)
const poolRoutes = require('./routes/pool'); // Import pool routes
const ppsRoutes = require('./routes/pps'); // Import PPS routes
const constantsRoutes = require('./routes/constants'); // Import Constants routes
const employeeRoutes = require('./routes/employee'); // Import Employee routes
const grantRoutes = require('./routes/grant'); // Import Grant routes

const app = express();
const port = process.env.BACKEND_PORT || 3001; // Example port

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

// CORS Middleware - BEFORE any routes
// Frontend URL from .env or default to common dev port for rsu_frontend service
// Allow both deployed frontend and localhost for CORS
const allowedOrigins = [
  'https://kiwi-frontend-4e5u.onrender.com', // Deployed frontend
  'http://localhost:8080' // Local development
];
app.use(cors({
  origin: allowedOrigins,

  credentials: true, // Important for cookies/auth headers in future, and for some Auth0 flows
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], // Explicitly allow standard methods
  allowedHeaders: [
    "Authorization", 
    "Content-Type", 
    "X-Requested-With", 
    "Accept", 
    "Origin", // Some browsers send Origin even on same-origin preflights
    // Add any other custom headers your frontend might send
  ],
  preflightContinue: false, // Let CORS middleware handle OPTIONS, don't pass to next route
  optionsSuccessStatus: 204 // For OPTIONS preflight, return 204 No Content
}));

app.use(express.json());

// Basic Request Logging Middleware
app.use((req, res, next) => {
  // Log request without sensitive info
  logger.info(`${req.method} ${req.originalUrl}`, { ip: req.ip });
  next();
});

// --- API Routes ---
// Public Routes (like health check)
app.get('/', (req, res) => {
  res.send('RSU/ESOP Platform Backend API');
});

// Basic health check endpoint that doesn't require auth
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

// Auth Routes (Removed - Handled by Auth0 Frontend Flow)
// app.use('/api/auth', authRoutes);

// Protected Routes
// Apply JWT check and user sync middleware globally to /api routes
app.use('/api', checkJwt, syncUser);

// Mount Tenant routes (already protected by checkJwt, syncUser)
app.use('/api/tenant', tenantRoutes);
// Mount User routes (already protected by checkJwt, syncUser)
app.use('/api/users', userRoutes);
// Mount Pool routes (already protected by checkJwt, syncUser)
app.use('/api/pools', poolRoutes);
// Mount PPS routes (already protected by checkJwt, syncUser)
app.use('/api/pps', ppsRoutes);
// Mount Constants routes (already protected by checkJwt, syncUser)
app.use('/api/constants', constantsRoutes);
// Mount Employee routes (already protected by checkJwt, syncUser)
app.use('/api/employees', employeeRoutes);
// Mount Grant routes (already protected by checkJwt, syncUser)
app.use('/api/grants', grantRoutes);

// Mount Audit Logs routes (already protected by checkJwt, syncUser)
const auditRoutes = require('./routes/audit');
app.use('/api/audit-logs', auditRoutes);

// Example of adding Admin role protection to a route group:
// app.use('/api/admin-only', authorizeRole('admin'), adminRoutes);

// --- Error Handling ---
// Basic Error Handling Middleware
app.use((err, req, res, next) => {
  // Log the error internally
  logger.error(err.message, { stack: err.stack, url: req.originalUrl, method: req.method, ip: req.ip });

  // Avoid leaking stack trace in production
  const errorResponse = {
    success: false,
    error: {
        code: err.code || 'INTERNAL_SERVER_ERROR',
        message: err.message || 'An unexpected error occurred.'
    }
  };

  // Set status code based on error, default to 500
  const statusCode = typeof err.status === 'number' ? err.status : 500;

  res.status(statusCode).json(errorResponse);
});

// --- Server Start ---
// app.listen(port, () => {
// logger.info(`Backend server listening on port ${port}`);
// });

// Start the server only if this file is run directly (not imported as a module)
if (require.main === module) {
  app.listen(port, () => {
    logger.info(`Backend server listening on port ${port}`);
  });
}

// Export pool for use in route handlers/controllers
// module.exports = { pool }; // This line should be removed or commented out
module.exports = app;
