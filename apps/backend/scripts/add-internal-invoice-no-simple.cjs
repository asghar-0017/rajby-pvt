/**
 * Script to add internalInvoiceNo column to invoices table for all tenants
 * CommonJS version for compatibility
 */

const mysql = require("mysql2/promise");

// Database configuration - update these values as needed
const config = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "fbr_aqms",
  port: process.env.DB_PORT || 3306,
};

async function addInternalInvoiceNoColumn() {
  let connection;

  try {
    console.log("🔌 Connecting to database...");
    connection = await mysql.createConnection(config);

    // Get all tenants
    console.log("📋 Fetching all tenants...");
    const [tenants] = await connection.execute(
      "SELECT tenant_id, tenant_name FROM tenants WHERE is_active = 1"
    );

    if (tenants.length === 0) {
      console.log("❌ No active tenants found");
      return;
    }

    console.log(`✅ Found ${tenants.length} active tenants`);

    // Add column to each tenant's invoices table
    for (const tenant of tenants) {
      const tenantId = tenant.tenant_id;
      const tenantName = tenant.tenant_name;

      console.log(`\n🔄 Processing tenant: ${tenantName} (ID: ${tenantId})`);

      try {
        // Check if column already exists
        const [columns] = await connection.execute(`
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = '${config.database}_tenant_${tenantId}' 
          AND TABLE_NAME = 'invoices' 
          AND COLUMN_NAME = 'internalInvoiceNo'
        `);

        if (columns.length > 0) {
          console.log(
            `  ✅ Column internalInvoiceNo already exists for tenant ${tenantName}`
          );
          continue;
        }

        // Add the column
        await connection.execute(`
          ALTER TABLE \`${config.database}_tenant_${tenantId}\`.\`invoices\` 
          ADD COLUMN \`internalInvoiceNo\` VARCHAR(100) NULL 
          AFTER \`companyInvoiceRefNo\`
        `);

        console.log(
          `  ✅ Successfully added internalInvoiceNo column for tenant ${tenantName}`
        );
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
addInternalInvoiceNoColumn()
  .then(() => {
    console.log("✅ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
