#!/usr/bin/env node

import mysql2 from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const masterDbConfig = {
  host: process.env.MYSQL_HOST || "157.245.150.54",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "root",
  port: process.env.MYSQL_PORT || 3306,
  database: process.env.MYSQL_MASTER_DB || "fbr_master",
};

const tenantDbConfig = {
  host: process.env.MYSQL_HOST || "157.245.150.54",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "root",
  port: process.env.MYSQL_PORT || 3306,
};

async function addInternalInvoiceNoField() {
  try {
    console.log(
      "🔍 Starting to add internal_invoice_no field to all tenant databases..."
    );

    // Connect to master database
    const masterConnection = await mysql2.createConnection(masterDbConfig);
    console.log("✅ Connected to master database");

    // Get all active tenants
    const [tenants] = await masterConnection.execute(
      "SELECT database_name FROM tenants WHERE is_active = 1"
    );

    console.log(`📋 Found ${tenants.length} active tenants`);

    // Add internal_invoice_no field to each tenant database
    for (const tenant of tenants) {
      const databaseName = tenant.database_name;
      console.log(`🔧 Processing tenant database: ${databaseName}`);

      try {
        // Connect to tenant database
        const tenantConnection = await mysql2.createConnection({
          ...tenantDbConfig,
          database: databaseName,
        });

        // Check if internal_invoice_no column already exists
        const [columns] = await tenantConnection.execute(
          "SHOW COLUMNS FROM invoices LIKE 'internal_invoice_no'"
        );

        if (columns.length === 0) {
          // Add the column
          await tenantConnection.execute(
            "ALTER TABLE invoices ADD COLUMN internal_invoice_no VARCHAR(100) NULL"
          );
          console.log(`✅ Added internal_invoice_no column to ${databaseName}`);
        } else {
          console.log(
            `ℹ️  internal_invoice_no column already exists in ${databaseName}`
          );
        }

        await tenantConnection.end();
      } catch (error) {
        console.error(`❌ Error processing ${databaseName}:`, error.message);
      }
    }

    // Add internal_invoice_no field to master tenants table
    console.log(
      "🔧 Adding internal_invoice_no field to master tenants table..."
    );

    const [masterColumns] = await masterConnection.execute(
      "SHOW COLUMNS FROM tenants LIKE 'internal_invoice_no'"
    );

    if (masterColumns.length === 0) {
      await masterConnection.execute(
        "ALTER TABLE tenants ADD COLUMN internal_invoice_no VARCHAR(100) NULL"
      );
      console.log(
        "✅ Added internal_invoice_no column to master tenants table"
      );
    } else {
      console.log(
        "ℹ️  internal_invoice_no column already exists in master tenants table"
      );
    }

    await masterConnection.end();

    console.log(
      "🎉 Successfully completed adding internal_invoice_no field to all databases!"
    );
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

addInternalInvoiceNoField();
