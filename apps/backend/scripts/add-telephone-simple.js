import mysql from "mysql2/promise";

/**
 * Simple migration script to add buyerTelephone column to buyers table
 * This script targets a specific database
 */
async function addTelephoneSimple() {
  let connection;

  try {
    console.log(
      "🚀 Starting migration to add telephone column to buyers table..."
    );

    // Connect to MySQL with a specific database
    connection = await mysql.createConnection({
      host: "localhost",
      port: 3307,
      user: "root",
      password: "root",
      database: "innovative123", // Target specific database
      multipleStatements: true,
    });

    console.log("✅ Connected to database: innovative123");

    // Check if buyers table exists
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = 'innovative123' AND TABLE_NAME = 'buyers'
    `);

    if (tables.length === 0) {
      console.log("❌ No buyers table found in innovative123 database");
      return;
    }

    console.log("✅ Found buyers table in innovative123");

    // Check if buyerTelephone column already exists
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'innovative123' 
      AND TABLE_NAME = 'buyers' 
      AND COLUMN_NAME = 'buyerTelephone'
    `);

    if (columns.length > 0) {
      console.log("✅ Column buyerTelephone already exists in innovative123");
      return;
    }

    // Add buyerTelephone column
    console.log("🔨 Adding buyerTelephone column to buyers table...");
    await connection.execute(`
      ALTER TABLE buyers 
      ADD COLUMN buyerTelephone VARCHAR(20) NULL AFTER buyerRegistrationType
    `);

    console.log("✅ Successfully added buyerTelephone column");

    // Add index on buyerTelephone for better search performance
    try {
      console.log("🔨 Adding index on buyerTelephone...");
      await connection.execute(`
        CREATE INDEX idx_buyer_telephone ON buyers(buyerTelephone)
      `);
      console.log("✅ Successfully added index on buyerTelephone");
    } catch (indexError) {
      if (indexError.message.includes("Duplicate key name")) {
        console.log("✅ Index on buyerTelephone already exists");
      } else {
        console.log(
          "⚠️  Could not create index on buyerTelephone:",
          indexError.message
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
addTelephoneSimple().catch(console.error);
