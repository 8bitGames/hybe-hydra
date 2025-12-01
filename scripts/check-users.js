const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DIRECT_URL });

async function main() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT id, email, name FROM users');
    const campaigns = await client.query('SELECT id, name FROM campaigns');
    console.log('Campaigns:', campaigns.rows);
    console.log('Users:', result.rows);
    client.release();
    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    await pool.end();
    process.exit(1);
  }
}

main();
