import mysql from "mysql2/promise";

/**
 * Final migration script to add buyerTelephone column to buyers table
 * This script targets the specific databases we found
 */
async function addTelephoneFinal() {
  let connection;

  try {
    console.log(
      "🚀 Starting migration to add telephone column to buyers table..."
    );

    // Connect to MySQL without specifying a database
    connection = await mysql.createConnection({
      host: "localhost",
      port: 3307,
      user: "root",
      password: "root",
      multipleStatements: true,
    });

    console.log("✅ Connected to MySQL");

    // Target databases that might have buyers table
    const targetDatabases = ["fbr_master", "hydra-foods"];

    for (const dbName of targetDatabases) {
      try {
        console.log(`\n🔧 Processing database: ${dbName}`);

        // Check if buyers table exists
        const [tables] = await connection.execute(
          `
          SELECT TABLE_NAME 
          FROM INFORMATION_SCHEMA.TABLES 
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'buyers'
        `,
          [dbName]
        );

        if (tables.length === 0) {
          console.log(`⏭️  No buyers table in ${dbName}, skipping...`);
          continue;
        }

        console.log(`✅ Found buyers table in ${dbName}`);

        // Use the database
        await connection.execute(`USE \`${dbName}\``);

        // Check if buyerTelephone column already exists
        const [columns] = await connection.execute(
          `
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = ? 
          AND TABLE_NAME = 'buyers' 
          AND COLUMN_NAME = 'buyerTelephone'
        `,
          [dbName]
        );

        if (columns.length > 0) {
          console.log(`✅ Column buyerTelephone already exists in ${dbName}`);
          continue;
        }

        // Add buyerTelephone column
        console.log(
          `🔨 Adding buyerTelephone column to buyers table in ${dbName}...`
        );
        await connection.execute(`
          ALTER TABLE buyers 
          ADD COLUMN buyerTelephone VARCHAR(20) NULL AFTER buyerRegistrationType
        `);

        console.log(`✅ Successfully added buyerTelephone column to ${dbName}`);

        // Add index on buyerTelephone for better search performance
        try {
          console.log(`🔨 Adding index on buyerTelephone in ${dbName}...`);
          await connection.execute(`
            CREATE INDEX idx_buyer_telephone ON buyers(buyerTelephone)
          `);
          console.log(
            `✅ Successfully added index on buyerTelephone in ${dbName}`
          );
        } catch (indexError) {
          if (indexError.message.includes("Duplicate key name")) {
            console.log(
              `✅ Index on buyerTelephone already exists in ${dbName}`
            );
          } else {
            console.log(
              `⚠️  Could not create index on buyerTelephone: ${indexError.message}`
            );
          }
        }
      } catch (dbError) {
        console.error(
          `❌ Error processing database ${dbName}:`,
          dbError.message
        );
        continue;
      }
    }

    console.log("\n🎉 Migration completed successfully!");
    console.log("📋 Summary:");
    console.log("- Added buyerTelephone column to all buyers tables");
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
addTelephoneFinal().catch(console.error);
