const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");

// Database configuration
const dbConfig = {
  host: "157.245.150.54",
  port: 3307,
  user: "root",
  password: "root",
  multipleStatements: true,
};

async function addDcDocFieldsToInvoiceItems() {
  let connection;

  try {
    console.log("🔌 Connecting to MySQL...");
    connection = await mysql.createConnection(dbConfig);
    console.log("✅ Connected to MySQL successfully");

    // Get list of all databases
    console.log("📊 Getting list of databases...");
    const [databases] = await connection.execute("SHOW DATABASES");

    // Filter out system databases and get tenant databases
    const tenantDatabases = databases
      .filter((db) => {
        const dbName = Object.values(db)[0];
        return (
          dbName &&
          ![
            "information_schema",
            "performance_schema",
            "mysql",
            "sys",
          ].includes(dbName) &&
          !dbName.startsWith("test")
        );
      })
      .map((db) => Object.values(db)[0]);

    console.log(
      `📊 Found ${tenantDatabases.length} potential tenant databases:`,
      tenantDatabases
    );

    if (tenantDatabases.length === 0) {
      console.log("❌ No tenant databases found");
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    // Process each tenant database
    for (const dbName of tenantDatabases) {
      try {
        console.log(`\n🔄 Processing database: ${dbName}`);

        // Check if invoice_items table exists
        const [tables] = await connection.execute(
          `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = '${dbName}' AND TABLE_NAME = 'invoice_items'`
        );

        if (tables.length === 0) {
          console.log(
            `⚠️  Table 'invoice_items' not found in ${dbName}, skipping...`
          );
          continue;
        }

        // Check if columns already exist
        const [columns] = await connection.execute(
          `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = '${dbName}' AND TABLE_NAME = 'invoice_items' AND COLUMN_NAME IN ('dcDocId', 'dcDocDate')`
        );

        const existingColumns = columns.map((col) => col.COLUMN_NAME);

        if (
          existingColumns.includes("dcDocId") &&
          existingColumns.includes("dcDocDate")
        ) {
          console.log(
            `✅ Columns 'dcDocId' and 'dcDocDate' already exist in ${dbName}, skipping...`
          );
          continue;
        }

        // Add dcDocId column if it doesn't exist
        if (!existingColumns.includes("dcDocId")) {
          console.log(
            `📝 Adding 'dcDocId' column to ${dbName}.invoice_items...`
          );
          await connection.execute(
            `ALTER TABLE \`${dbName}\`.\`invoice_items\` ADD COLUMN \`dcDocId\` VARCHAR(100) NULL AFTER \`rate\``
          );
          console.log(`✅ Added 'dcDocId' column to ${dbName}.invoice_items`);
        }

        // Add dcDocDate column if it doesn't exist
        if (!existingColumns.includes("dcDocDate")) {
          console.log(
            `📝 Adding 'dcDocDate' column to ${dbName}.invoice_items...`
          );
          await connection.execute(
            `ALTER TABLE \`${dbName}\`.\`invoice_items\` ADD COLUMN \`dcDocDate\` DATE NULL AFTER \`dcDocId\``
          );
          console.log(`✅ Added 'dcDocDate' column to ${dbName}.invoice_items`);
        }

        successCount++;
        console.log(`✅ Successfully updated ${dbName}.invoice_items`);
      } catch (error) {
        errorCount++;
        console.error(`❌ Error processing ${dbName}:`, error.message);
      }
    }

    console.log(`\n📊 Migration Summary:`);
    console.log(`✅ Successfully updated: ${successCount} databases`);
    console.log(`❌ Errors: ${errorCount} databases`);
  } catch (error) {
    console.error("❌ Migration failed:", error);
  } finally {
    if (connection) {
      await connection.end();
      console.log("🔌 Database connection closed");
    }
  }
}

// Run the migration
addDcDocFieldsToInvoiceItems()
  .then(() => {
    console.log("🎉 Migration completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Migration failed:", error);
    process.exit(1);
  });
