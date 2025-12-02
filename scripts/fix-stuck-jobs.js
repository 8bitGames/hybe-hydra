const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DIRECT_URL });

async function main() {
  try {
    const client = await pool.connect();

    // First check what we're about to update
    console.log('=== Checking stuck jobs ===');
    const stuckJobs = await client.query(`
      SELECT id, status, progress, error_message
      FROM video_generations
      WHERE id LIKE 'compose-var-%' AND status = 'PROCESSING'
    `);
    console.log(`Found ${stuckJobs.rowCount} stuck jobs`);
    stuckJobs.rows.forEach(r => console.log(`  - ${r.id}`));

    if (stuckJobs.rowCount > 0) {
      // Update the stuck jobs
      console.log('\n=== Fixing stuck jobs ===');
      const result = await client.query(`
        UPDATE video_generations
        SET status = 'FAILED', progress = 100, error_message = 'Compose engine unavailable', updated_at = NOW()
        WHERE id LIKE 'compose-var-%' AND status = 'PROCESSING'
        RETURNING id
      `);
      console.log(`Updated ${result.rowCount} stuck jobs:`);
      result.rows.forEach(r => console.log(`  - ${r.id}`));
    }

    client.release();
    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    await pool.end();
  }
}

main();
