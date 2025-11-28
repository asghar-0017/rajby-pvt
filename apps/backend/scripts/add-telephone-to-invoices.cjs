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

async function addTelephoneToInvoices() {
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

    // Process each database
    for (const dbName of tenantDatabases) {
      try {
        console.log(`\n🔄 Processing database: ${dbName}`);

        // Switch to the database
        await connection.query(`USE \`${dbName}\``);

        // Check if invoices table exists
        const [tables] = await connection.execute(
          "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'invoices'",
          [dbName]
        );

        if (tables.length === 0) {
          console.log(
            `⚠️  No 'invoices' table found in ${dbName}, skipping...`
          );
          continue;
        }

        console.log(`✅ Found 'invoices' table in ${dbName}`);

        // Check if buyerTelephone column already exists
        const [columns] = await connection.execute(
          "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'buyerTelephone'",
          [dbName]
        );

        if (columns.length > 0) {
          console.log(
            `✅ Column 'buyerTelephone' already exists in ${dbName}.invoices, skipping...`
          );
          continue;
        }

        // Add buyerTelephone column
        console.log(
          `🔧 Adding 'buyerTelephone' column to ${dbName}.invoices...`
        );
        await connection.query(`
          ALTER TABLE \`invoices\` 
          ADD COLUMN \`buyerTelephone\` VARCHAR(20) NULL 
          AFTER \`buyerRegistrationType\`
        `);

        console.log(
          `✅ Successfully added 'buyerTelephone' column to ${dbName}.invoices`
        );

        // Add index for better performance
        console.log(
          `🔧 Adding index for 'buyerTelephone' in ${dbName}.invoices...`
        );
        try {
          await connection.query(`
            CREATE INDEX \`idx_invoices_buyer_telephone\` 
            ON \`invoices\` (\`buyerTelephone\`)
          `);
          console.log(
            `✅ Successfully added index for 'buyerTelephone' in ${dbName}.invoices`
          );
        } catch (indexError) {
          console.log(
            `⚠️  Index creation failed (may already exist): ${indexError.message}`
          );
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
addTelephoneToInvoices().catch(console.error);
