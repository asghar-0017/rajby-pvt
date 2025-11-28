/**
 * Script to add created_by columns to products table for all tenants
 * Adds: created_by_user_id, created_by_email, created_by_name
 */

const mysql = require("mysql2/promise");

// Database configuration - update these values as needed
const config = {
  host: process.env.MYSQL_HOST || "157.245.150.54",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_MASTER_DB || "fbr_master",
  port: process.env.MYSQL_PORT || 3307,
};

async function addCreatedByColumnsToProducts() {
  let connection;

  try {
    console.log("🔌 Connecting to database...");
    connection = await mysql.createConnection(config);

    // Get all tenants
    console.log("📋 Fetching all tenants...");
    const [tenants] = await connection.execute(
      "SELECT tenant_id, seller_business_name FROM tenants WHERE is_active = 1"
    );

    if (tenants.length === 0) {
      console.log("❌ No active tenants found");
      return;
    }

    console.log(`✅ Found ${tenants.length} active tenants`);

    // Add columns to each tenant's products table
    for (const tenant of tenants) {
      const tenantId = tenant.tenant_id;
      const tenantName = tenant.seller_business_name;

      console.log(`\n🔄 Processing tenant: ${tenantName} (ID: ${tenantId})`);

      try {
        const databaseName = `${config.database}_tenant_${tenantId}`;

        // Check if products table exists
        const [tables] = await connection.execute(`
          SELECT TABLE_NAME 
          FROM INFORMATION_SCHEMA.TABLES 
          WHERE TABLE_SCHEMA = '${databaseName}' 
          AND TABLE_NAME = 'products'
        `);

        if (tables.length === 0) {
          console.log(
            `  ⚠️  Products table does not exist for tenant ${tenantName}, skipping...`
          );
          continue;
        }

        // Check which columns already exist
        const [existingColumns] = await connection.execute(`
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = '${databaseName}' 
          AND TABLE_NAME = 'products' 
          AND COLUMN_NAME IN ('created_by_user_id', 'created_by_email', 'created_by_name')
        `);

        const existingColumnNames = existingColumns.map(
          (col) => col.COLUMN_NAME
        );
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
          console.log(
            `  ✅ All created_by columns already exist for tenant ${tenantName}`
          );
          continue;
        }

        // Add the missing columns
        for (const columnDef of columnsToAdd) {
          const columnName = columnDef.split(" ")[0];
          await connection.execute(`
            ALTER TABLE \`${databaseName}\`.\`products\` 
            ADD COLUMN \`${columnName}\` ${columnDef.split(" ").slice(1).join(" ")}
          `);
          console.log(
            `  ✅ Added column ${columnName} for tenant ${tenantName}`
          );
        }

        console.log(`  🎉 Successfully processed tenant ${tenantName}`);
      } catch (error) {
        console.error(
          `  ❌ Error processing tenant ${tenantName}:`,
          error.message
        );
      }
    }

    console.log("\n🎉 Column addition process completed!");
  } catch (error) {
    console.error("❌ Script failed:", error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log("🔌 Database connection closed");
    }
  }
}

// Run the script
addCreatedByColumnsToProducts()
  .then(() => {
    console.log("✅ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
