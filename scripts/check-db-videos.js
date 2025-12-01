const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DIRECT_URL });

async function main() {
  try {
    const client = await pool.connect();

    // Check all videos
    console.log('=== All Video Generations ===');
    const allVideos = await client.query(`
      SELECT id, status, output_url, composed_output_url, prompt
      FROM video_generations
      ORDER BY created_at DESC
    `);

    console.log(`Total videos: ${allVideos.rowCount}`);
    allVideos.rows.forEach(v => {
      console.log(`---`);
      console.log(`ID: ${v.id}`);
      console.log(`Status: ${v.status}`);
      console.log(`Prompt: ${v.prompt?.substring(0, 50)}...`);
      console.log(`output_url: ${v.output_url || 'null'}`);
      console.log(`composed_output_url: ${v.composed_output_url || 'null'}`);
    });

    // Count by status
    console.log('\n=== Count by Status ===');
    const byStatus = await client.query(`
      SELECT status, COUNT(*) as count
      FROM video_generations
      GROUP BY status
    `);
    byStatus.rows.forEach(r => console.log(`${r.status}: ${r.count}`));

    // Count composed videos
    console.log('\n=== Composed Videos ===');
    const composed = await client.query(`
      SELECT COUNT(*) as count FROM video_generations WHERE composed_output_url IS NOT NULL
    `);
    console.log(`Composed videos: ${composed.rows[0].count}`);

    client.release();
    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    await pool.end();
  }
}

main();
