const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDatabase() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('Database initialized successfully');
}

async function getCachedVin(vin) {
  const result = await pool.query(
    `SELECT * FROM vin_lookups
     WHERE vin = $1 AND updated_at > NOW() - INTERVAL '24 hours'`,
    [vin]
  );
  if (result.rows.length > 0) {
    await pool.query(
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
       vin_data     = $2,
       recalls_data = $3,
       complaints_data = $4,
       market_data  = $5,
       images_data  = $6,
       ai_summary   = $7,
       updated_at   = CURRENT_TIMESTAMP,
       lookup_count = vin_lookups.lookup_count + 1
     RETURNING *`,
    [vin, vinData, recalls, complaints, marketData, images, aiSummary]
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

module.exports = { pool, initDatabase, getCachedVin, saveVinLookup, getRecentLookups };
