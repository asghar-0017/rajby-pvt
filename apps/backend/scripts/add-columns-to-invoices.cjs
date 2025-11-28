/**
 * Script to add created_by columns to invoices table in hydra-foods database
 */

// Load environment variables
require("dotenv").config();

const mysql = require("mysql2/promise");

// Database configuration
const config = {
  host: process.env.MYSQL_HOST || "157.245.150.54",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: "hydra-foods", // Direct connection to hydra-foods database
  port: process.env.MYSQL_PORT || 3307,
};

async function addColumnsToInvoices() {
  let connection;

  try {
    console.log("🔌 Connecting to hydra-foods database...");
    connection = await mysql.createConnection(config);

    console.log("✅ Connected successfully!");

    // Check if invoices table exists
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = 'hydra-foods' 
      AND TABLE_NAME = 'invoices'
    `);

    if (tables.length === 0) {
      console.log("❌ Invoices table does not exist in hydra-foods database");
      return;
    }

    console.log("✅ Invoices table found!");

    // Check which columns already exist
    const [existingColumns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'hydra-foods' 
      AND TABLE_NAME = 'invoices' 
      AND COLUMN_NAME IN ('created_by_user_id', 'created_by_email', 'created_by_name')
    `);

    const existingColumnNames = existingColumns.map((col) => col.COLUMN_NAME);
    console.log("Existing created_by columns:", existingColumnNames);

    const columnsToAdd = [];

    if (!existingColumnNames.includes("created_by_user_id")) {
      columnsToAdd.push("created_by_user_id INT NULL");
    }
    if (!existingColumnNames.includes("created_by_email")) {
      columnsToAdd.push("created_by_email VARCHAR(255) NULL");
    }
    if (!existingColumnNames.includes("created_by_name")) {
      columnsToAdd.push("created_by_name VARCHAR(255) NULL");
    }

    if (columnsToAdd.length === 0) {
      console.log("✅ All created_by columns already exist in invoices table!");
      return;
    }

    console.log(
      `📝 Adding ${columnsToAdd.length} columns to invoices table...`
    );

    // Add the missing columns
    for (const columnDef of columnsToAdd) {
      const columnName = columnDef.split(" ")[0];
      await connection.execute(`
        ALTER TABLE invoices 
        ADD COLUMN \`${columnName}\` ${columnDef.split(" ").slice(1).join(" ")}
      `);
      console.log(`✅ Added column: ${columnName}`);
    }

    // Show final table structure
    console.log("\n📋 Final invoices table structure:");
    const [finalStructure] = await connection.execute("DESCRIBE invoices");
    finalStructure.forEach((col) => {
      console.log(
        `  - ${col.Field}: ${col.Type} ${col.Null === "YES" ? "NULL" : "NOT NULL"}`
      );
    });

    console.log("\n🎉 All columns added successfully to invoices table!");
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
addColumnsToInvoices()
  .then(() => {
    console.log("✅ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
