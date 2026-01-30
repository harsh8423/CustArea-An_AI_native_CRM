require('dotenv').config();
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not defined in environment variables');
  process.exit(1);
}

console.log('Initializing database connection pool...');
console.log('Database URL:', process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@')); // Log with masked password

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Supabase
  }
});

pool.on('connect', () => {
  console.log('✓ Database pool client connected');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client:', err);
  process.exit(-1);
});

// Test connection immediately
(async () => {
  try {
    const client = await pool.connect();
    console.log('✓ Database connection test successful');
    client.release();
  } catch (err) {
    console.error('✗ Database connection test failed:', err.message);
    console.error('Please check your DATABASE_URL and network connectivity');
  }
})();

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
