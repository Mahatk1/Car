const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Always use SSL when connecting to Render-hosted PostgreSQL
const sslConfig = process.env.DATABASE_URL?.includes('render.com')
  ? { rejectUnauthorized: false }
  : process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 5
});

// Log pool-level errors so they appear in Render logs
pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err.message);
});

let dbReady = false;

async function initDatabase() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  dbReady = true;
  console.log('Database initialized successfully');
}

async function testConnection() {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (err) {
    console.error('Database connection test failed:', err.message);
    return false;
  }
}

async function getCachedVin(vin) {
  const result = await pool.query(
    `SELECT * FROM vin_lookups
     WHERE vin = $1 AND updated_at > NOW() - INTERVAL '24 hours'`,
    [vin]
  );
  if (result.rows.length > 0) {
    pool.query(
      `UPDATE vin_lookups SET lookup_count = lookup_count + 1 WHERE vin = $1`,
      [vin]
    ).catch(() => {});
    return result.rows[0];
  }
  return null;
}

async function saveVinLookup(vin, { vinData, recalls, complaints, marketData, images, aiSummary }) {
  const result = await pool.query(
    `INSERT INTO vin_lookups
       (vin, vin_data, recalls_data, complaints_data, market_data, images_data, ai_summary)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (vin) DO UPDATE SET
       vin_data        = $2,
       recalls_data    = $3,
       complaints_data = $4,
       market_data     = $5,
       images_data     = $6,
       ai_summary      = $7,
       updated_at      = CURRENT_TIMESTAMP,
       lookup_count    = vin_lookups.lookup_count + 1
     RETURNING *`,
    [
      vin,
      JSON.stringify(vinData),
      JSON.stringify(recalls),
      JSON.stringify(complaints),
      JSON.stringify(marketData),
      JSON.stringify(images),
      aiSummary
    ]
  );
  return result.rows[0];
}

async function getRecentLookups(limit = 10) {
  const result = await pool.query(
    `SELECT vin,
       vin_data->>'year'  AS year,
       vin_data->>'make'  AS make,
       vin_data->>'model' AS model,
       lookup_count,
       updated_at
     FROM vin_lookups
     ORDER BY updated_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

module.exports = { pool, initDatabase, testConnection, getCachedVin, saveVinLookup, getRecentLookups };
