// Use tsx to run this since it uses TypeScript imports
const { Pool } = require("pg");

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Check if oauth_states table exists
    const tableCheck = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'oauth_states'
    `);
    console.log("Table exists:", tableCheck.rows.length > 0);

    if (tableCheck.rows.length > 0) {
      // Get count
      const count = await pool.query("SELECT COUNT(*) FROM oauth_states");
      console.log("OAuth states count:", count.rows[0].count);

      // Get recent states
      const states = await pool.query("SELECT * FROM oauth_states ORDER BY created_at DESC LIMIT 5");
      console.log("Recent states:", states.rows);
    } else {
      console.log("oauth_states table does not exist!");
      console.log("Need to run: npx prisma db push");
    }
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await pool.end();
  }
}

main();
