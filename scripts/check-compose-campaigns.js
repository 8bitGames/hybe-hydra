const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DIRECT_URL });

async function main() {
  try {
    const client = await pool.connect();

    console.log('=== Compose Videos with Campaign Info ===');
    const composeVideos = await client.query(`
      SELECT vg.id, vg.campaign_id, vg.status, vg.composed_output_url,
             c.name as campaign_name
      FROM video_generations vg
      LEFT JOIN campaigns c ON vg.campaign_id = c.id
      WHERE vg.id LIKE 'compose-%'
      ORDER BY vg.created_at DESC
    `);

    console.log(`Found ${composeVideos.rowCount} compose videos:`);
    composeVideos.rows.forEach(v => {
      console.log(`---`);
      console.log(`ID: ${v.id}`);
      console.log(`campaign_id: ${v.campaign_id || 'NULL'}`);
      console.log(`campaign_name: ${v.campaign_name || 'N/A'}`);
      console.log(`status: ${v.status}`);
      console.log(`composed_output_url: ${v.composed_output_url?.substring(0, 80)}...`);
    });

    // Check which campaigns exist
    console.log('\n=== All Campaigns ===');
    const campaigns = await client.query(`SELECT id, name FROM campaigns`);
    campaigns.rows.forEach(c => console.log(`  ${c.id}: ${c.name}`));

    client.release();
    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    await pool.end();
  }
}

main();
