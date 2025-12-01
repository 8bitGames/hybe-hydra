const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DIRECT_URL });

async function main() {
  const client = await pool.connect();
  const result = await client.query(`
    SELECT id, output_url IS NOT NULL as has_output, composed_output_url IS NOT NULL as has_composed, created_at
    FROM video_generations
    WHERE status = 'COMPLETED'
    ORDER BY created_at DESC
    LIMIT 15
  `);
  console.log('All completed videos (sorted by created_at DESC):');
  result.rows.forEach(r => {
    const id = r.id.length > 30 ? r.id.substring(0, 30) + '...' : r.id;
    console.log(`  ${id} | output:${r.has_output} | composed:${r.has_composed} | ${r.created_at.toISOString().substring(0, 19)}`);
  });
  client.release();
  await pool.end();
}
main().catch(e => console.error(e));
