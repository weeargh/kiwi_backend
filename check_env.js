const path = require('path');
const fs = require('fs');

const envPath = path.resolve(__dirname, '.env');

console.log(`Attempting to load .env file from: ${envPath}`);

// Try to read the file manually first
try {
  const fileContent = fs.readFileSync(envPath, { encoding: 'utf8' });
  console.log('First 100 chars of .env file:', fileContent.substring(0, 100));
} catch (err) {
  console.error('Error manually reading .env file:', err.message);
}

// Now try to load with dotenv
const dotenvResult = require('dotenv').config({ path: envPath, debug: true });

if (dotenvResult.error) {
  console.error('dotenv.config() error:', dotenvResult.error.message);
}

console.log('After dotenv.config():');
console.log('  process.env.DB_USER:', process.env.DB_USER);
console.log('  process.env.DB_HOST:', process.env.DB_HOST);
console.log('  process.env.DB_PASSWORD:', process.env.DB_PASSWORD ? '******' : undefined); // Don't log actual password
console.log('  process.env.NODE_ENV:', process.env.NODE_ENV); // Check if Jest sets this by the time we run this manually 