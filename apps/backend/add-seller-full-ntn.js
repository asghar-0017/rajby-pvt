#!/usr/bin/env node

import mysql2 from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const masterDbConfig = {
  host: process.env.MYSQL_HOST || "localhost",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "root",
  port: process.env.MYSQL_PORT || 3306,
  database: process.env.MYSQL_MASTER_DB || "fbr_master",
};

const tenantDbConfig = {
  host: process.env.MYSQL_HOST || "localhost",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "root",
  port: process.env.MYSQL_PORT || 3306,
};

async function addSellerFullNTNField() {
  try {
    console.log(
      "🔍 Starting to add sellerFullNTN field to all tenant databases..."
    );

    // Connect to master database
    const masterConnection = await mysql2.createConnection(masterDbConfig);
    console.log("✅ Connected to master database");

    // Get all active tenants
    const [tenants] = await masterConnection.execute(
      "SELECT database_name FROM tenants WHERE is_active = 1"
    );

    console.log(`📋 Found ${tenants.length} active tenants`);

    // Add sellerFullNTN field to each tenant database
    for (const tenant of tenants) {
      const databaseName = tenant.database_name;
      console.log(`🔧 Processing tenant database: ${databaseName}`);

      try {
        // Connect to tenant database
        const tenantConnection = await mysql2.createConnection({
          ...tenantDbConfig,
          database: databaseName,
        });

        // Check if sellerFullNTN column already exists
        const [columns] = await tenantConnection.execute(
          "SHOW COLUMNS FROM invoices LIKE 'sellerFullNTN'"
        );

        if (columns.length === 0) {
          // Add the column
          await tenantConnection.execute(
            "ALTER TABLE invoices ADD COLUMN sellerFullNTN VARCHAR(50) NULL"
          );
          console.log(`✅ Added sellerFullNTN column to ${databaseName}`);
        } else {
          console.log(
            `ℹ️  sellerFullNTN column already exists in ${databaseName}`
          );
        }

        await tenantConnection.end();
      } catch (error) {
        console.error(`❌ Error processing ${databaseName}:`, error.message);
      }
    }

    // Add seller_full_ntn field to master tenants table
    console.log("🔧 Adding seller_full_ntn field to master tenants table...");

    const [masterColumns] = await masterConnection.execute(
      "SHOW COLUMNS FROM tenants LIKE 'seller_full_ntn'"
    );

    if (masterColumns.length === 0) {
      await masterConnection.execute(
        "ALTER TABLE tenants ADD COLUMN seller_full_ntn VARCHAR(50) NULL"
      );
      console.log("✅ Added seller_full_ntn column to master tenants table");
    } else {
      console.log(
        "ℹ️  seller_full_ntn column already exists in master tenants table"
      );
    }

    await masterConnection.end();

    console.log(
      "🎉 Successfully completed adding sellerFullNTN field to all databases!"
    );
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

addSellerFullNTNField();
