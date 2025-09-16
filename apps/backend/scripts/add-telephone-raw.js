import mysql from "mysql2/promise";

/**
 * Raw SQL migration script to add buyerTelephone column to buyers table
 */
async function addTelephoneRaw() {
  let connection;

  try {
    console.log(
      "🚀 Starting migration to add telephone column to buyers table..."
    );

    // Connect to MySQL
    connection = await mysql.createConnection({
      host: "localhost",
      port: 3307,
      user: "root",
      password: "root",
      multipleStatements: true,
    });

    console.log("✅ Connected to MySQL");

    // Target the hydra-foods database
    const dbName = "hydra-foods";

    console.log(`\n🔧 Processing database: ${dbName}`);

    // Use the database
    await connection.query(`USE \`${dbName}\``);

    // Check if buyerTelephone column already exists
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = '${dbName}' 
      AND TABLE_NAME = 'buyers' 
      AND COLUMN_NAME = 'buyerTelephone'
    `);

    if (columns.length > 0) {
      console.log(`✅ Column buyerTelephone already exists in ${dbName}`);
    } else {
      // Add buyerTelephone column
      console.log(
        `🔨 Adding buyerTelephone column to buyers table in ${dbName}...`
      );
      await connection.query(`
        ALTER TABLE buyers 
        ADD COLUMN buyerTelephone VARCHAR(20) NULL AFTER buyerRegistrationType
      `);

      console.log(`✅ Successfully added buyerTelephone column to ${dbName}`);
    }

    // Add index on buyerTelephone for better search performance
    try {
      console.log(`🔨 Adding index on buyerTelephone in ${dbName}...`);
      await connection.query(`
        CREATE INDEX idx_buyer_telephone ON buyers(buyerTelephone)
      `);
      console.log(`✅ Successfully added index on buyerTelephone in ${dbName}`);
    } catch (indexError) {
      if (indexError.message.includes("Duplicate key name")) {
        console.log(`✅ Index on buyerTelephone already exists in ${dbName}`);
      } else {
        console.log(
          `⚠️  Could not create index on buyerTelephone: ${indexError.message}`
        );
      }
    }

    console.log("\n🎉 Migration completed successfully!");
    console.log("📋 Summary:");
    console.log("- Added buyerTelephone column to buyers table");
    console.log(
      "- Added index on buyerTelephone for better search performance"
    );
    console.log(
      "- Column is nullable to maintain compatibility with existing data"
    );
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log("🔌 Database connection closed");
    }
  }
}

// Run the migration
addTelephoneRaw().catch(console.error);
