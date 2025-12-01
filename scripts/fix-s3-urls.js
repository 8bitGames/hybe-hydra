const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DIRECT_URL;
console.log('Connecting to:', connectionString?.replace(/:[^:@]+@/, ':****@'));

const pool = new Pool({ connectionString });

async function main() {
  try {
    console.log('Connecting to database...');
    const client = await pool.connect();
    console.log('Connected!\n');

    // Fix assets table - s3_url and s3_key
    console.log('Fixing assets table URLs...');
    const assetsResult = await client.query(`
      UPDATE assets
      SET s3_url = REPLACE(s3_url, 'ap-northeast-2', 'ap-southeast-2')
      WHERE s3_url LIKE '%ap-northeast-2%'
      RETURNING id, original_filename, s3_url
    `);
    console.log(`Updated ${assetsResult.rowCount} asset URLs`);
    assetsResult.rows.forEach(row => {
      console.log(`  - ${row.original_filename}: ${row.s3_url.substring(0, 60)}...`);
    });

    // Fix video_generations table - output_url
    console.log('\nFixing video_generations output_url...');
    const outputResult = await client.query(`
      UPDATE video_generations
      SET output_url = REPLACE(output_url, 'ap-northeast-2', 'ap-southeast-2')
      WHERE output_url LIKE '%ap-northeast-2%'
      RETURNING id, prompt, output_url
    `);
    console.log(`Updated ${outputResult.rowCount} video output URLs`);
    outputResult.rows.forEach(row => {
      console.log(`  - ${row.id}: ${row.output_url?.substring(0, 60)}...`);
    });

    // Fix video_generations table - composed_output_url
    console.log('\nFixing video_generations composed_output_url...');
    const composedResult = await client.query(`
      UPDATE video_generations
      SET composed_output_url = REPLACE(composed_output_url, 'ap-northeast-2', 'ap-southeast-2')
      WHERE composed_output_url LIKE '%ap-northeast-2%'
      RETURNING id, prompt, composed_output_url
    `);
    console.log(`Updated ${composedResult.rowCount} composed video URLs`);
    composedResult.rows.forEach(row => {
      console.log(`  - ${row.id}: ${row.composed_output_url?.substring(0, 60)}...`);
    });

    // Verify the changes
    console.log('\n--- Verification ---');
    const verifyAssets = await client.query(`SELECT COUNT(*) FROM assets WHERE s3_url LIKE '%ap-northeast-2%'`);
    const verifyOutput = await client.query(`SELECT COUNT(*) FROM video_generations WHERE output_url LIKE '%ap-northeast-2%'`);
    const verifyComposed = await client.query(`SELECT COUNT(*) FROM video_generations WHERE composed_output_url LIKE '%ap-northeast-2%'`);

    console.log(`Remaining ap-northeast-2 URLs:`);
    console.log(`  - assets: ${verifyAssets.rows[0].count}`);
    console.log(`  - video output_url: ${verifyOutput.rows[0].count}`);
    console.log(`  - video composed_output_url: ${verifyComposed.rows[0].count}`);

    // Show sample corrected URL
    const sample = await client.query(`SELECT s3_url FROM assets LIMIT 1`);
    if (sample.rows.length > 0) {
      console.log(`\nSample corrected URL: ${sample.rows[0].s3_url}`);
    }

    client.release();
    await pool.end();
    console.log('\nDone!');
  } catch (err) {
    console.error('Error:', err.message);
    await pool.end();
    process.exit(1);
  }
}

main();
