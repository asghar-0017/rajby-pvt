/**
 * Script to add seller_telephone_no column to tenants table
 * Adds: seller_telephone_no VARCHAR(20) NULL
 */

import mysql from "mysql2/promise";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Database configuration - update these values as needed
const config = {
  host: process.env.MYSQL_HOST || "157.245.150.54",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_MASTER_DB || "fbr_master",
  port: process.env.MYSQL_PORT || 3307,
};

async function addTelephoneToTenants() {
  let connection;

  try {
    console.log("🔌 Connecting to master database...");
    connection = await mysql.createConnection(config);

    console.log("✅ Connected successfully!");

    // Check if tenants table exists
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = '${config.database}' 
      AND TABLE_NAME = 'tenants'
    `);

    if (tables.length === 0) {
      console.log("❌ Tenants table does not exist in master database");
      return;
    }

    console.log("✅ Tenants table found!");

    // Check if seller_telephone_no column already exists
    const [existingColumns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = '${config.database}' 
      AND TABLE_NAME = 'tenants' 
      AND COLUMN_NAME = 'seller_telephone_no'
    `);

    if (existingColumns.length > 0) {
      console.log(
        "✅ seller_telephone_no column already exists in tenants table!"
      );
      return;
    }

    console.log("📝 Adding seller_telephone_no column to tenants table...");

    // Add the seller_telephone_no column
    await connection.execute(`
      ALTER TABLE tenants 
      ADD COLUMN seller_telephone_no VARCHAR(20) NULL
    `);

    console.log("✅ Added column: seller_telephone_no");

    // Show final table structure
    console.log("\n📋 Final tenants table structure:");
    const [finalStructure] = await connection.execute("DESCRIBE tenants");
    finalStructure.forEach((col) => {
      console.log(
        `  - ${col.Field}: ${col.Type} ${col.Null === "YES" ? "NULL" : "NOT NULL"}`
      );
    });

    console.log(
      "\n🎉 seller_telephone_no column added successfully to tenants table!"
    );
  } catch (error) {
    console.error("❌ Script failed:", error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log("🔌 Database connection closed");
    }
  }
}

// Run the script
addTelephoneToTenants()
  .then(() => {
    console.log("✅ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
