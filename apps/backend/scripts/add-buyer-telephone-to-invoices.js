import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";

// Database configuration
const config = {
  host: process.env.MYSQL_HOST || "157.245.150.54",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  port: process.env.MYSQL_PORT || 3306,
  multipleStatements: true,
};

console.log("🔧 Database configuration:", {
  host: config.host,
  user: config.user,
  port: config.port,
  hasPassword: !!config.password,
});

async function addBuyerTelephoneToInvoices() {
  let connection;

  try {
    console.log(
      "🚀 Starting migration: Adding buyer_telephone column to invoices table..."
    );

    // Connect to MySQL
    connection = await mysql.createConnection(config);
    console.log("✅ Connected to MySQL database");

    // Get all tenant databases
    const [databases] = await connection.execute("SHOW DATABASES");
    const tenantDatabases = databases
      .map((db) => db.Database)
      .filter(
        (dbName) => dbName.startsWith("tenant_") && dbName !== "tenant_template"
      );

    console.log(
      `📊 Found ${tenantDatabases.length} tenant databases to update`
    );

    let successCount = 0;
    let errorCount = 0;

    for (const dbName of tenantDatabases) {
      try {
        console.log(`\n🔧 Processing database: ${dbName}`);

        // Switch to the tenant database
        await connection.execute(`USE \`${dbName}\``);

        // Check if buyer_telephone column already exists
        const [columns] = await connection.execute(`
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = '${dbName}' 
          AND TABLE_NAME = 'invoices' 
          AND COLUMN_NAME = 'buyer_telephone'
        `);

        if (columns.length > 0) {
          console.log(
            `⚠️  Column buyer_telephone already exists in ${dbName}.invoices - skipping`
          );
          continue;
        }

        // Add buyer_telephone column to invoices table
        await connection.execute(`
          ALTER TABLE invoices 
          ADD COLUMN buyer_telephone VARCHAR(20) NULL 
          AFTER buyer_registration_type
        `);

        console.log(
          `✅ Successfully added buyer_telephone column to ${dbName}.invoices`
        );
        successCount++;
      } catch (error) {
        console.error(`❌ Error processing database ${dbName}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n📈 Migration Summary:`);
    console.log(`✅ Successfully updated: ${successCount} databases`);
    console.log(`❌ Errors: ${errorCount} databases`);

    if (errorCount === 0) {
      console.log("🎉 Migration completed successfully!");
    } else {
      console.log(
        "⚠️  Migration completed with some errors. Please check the logs above."
      );
    }
  } catch (error) {
    console.error("💥 Migration failed:", error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log("🔌 Database connection closed");
    }
  }
}

// Run the migration
addBuyerTelephoneToInvoices()
  .then(() => {
    console.log("🏁 Migration script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Migration script failed:", error);
    process.exit(1);
  });
