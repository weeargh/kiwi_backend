require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');

const app = express();
const port = process.env.BACKEND_PORT || 3001; // Example port

app.use(express.json()); // Middleware to parse JSON bodies

// Basic Database Connection Setup (Example - adjust with real config later)
// const pool = new Pool({
//   user: process.env.DB_USER,
//   host: process.env.DB_HOST,
//   database: process.env.DB_NAME,
//   password: process.env.DB_PASSWORD,
//   port: process.env.DB_PORT || 5432,
// });

// Simple Root Route
app.get('/', (req, res) => {
  res.send('RSU/ESOP Platform Backend API');
});

// Example API endpoint (will be replaced later)
app.get('/api/ping', (req, res) => {
  res.json({ message: 'pong' });
});

// Health Check Endpoint (as defined in api.yml)
app.get('/health', (req, res) => {
  // In a real app, check DB connection etc.
  res.json({
    status: 'healthy',
    version: require('./package.json').version, // Read version from package.json
    database: 'connected', // Placeholder
    uptime: process.uptime(),
  });
});

app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);
}); 