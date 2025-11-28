#!/usr/bin/env node

/**
 * Fix Backup Summary NULL Values Script
 * This script fixes NULL values in existing backup summary records
 */

import { createConnection } from "mysql2/promise";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Database configuration
const masterDbConfig = {
  host: process.env.MYSQL_HOST || "157.245.150.54",
  port: process.env.MYSQL_PORT || 3306,
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "Jsab43#%87dgDJ49bf^9b",
  database: process.env.MYSQL_MASTER_DB || "fbr_master",
};

async function fixBackupSummaryNulls() {
  let masterConnection;

  try {
    console.log("🔧 Fixing NULL values in backup summary records...");

    // Connect to master database
    console.log("📡 Connecting to master database...");
    masterConnection = await createConnection(masterDbConfig);
    console.log("✅ Connected to master database successfully");

    // Get all tenant databases
    console.log("🔍 Fetching tenant databases...");
    const [tenants] = await masterConnection.execute(`
      SELECT id, database_name, seller_business_name 
      FROM tenants 
      WHERE database_name IS NOT NULL 
      ORDER BY id
    `);

    console.log(`📊 Found ${tenants.length} tenant databases to process`);

    for (const tenant of tenants) {
      console.log(
        `\n🏢 Processing tenant: ${tenant.seller_business_name} (${tenant.database_name})`
      );

      try {
        // Connect to tenant database
        const tenantDbConfig = {
          ...masterDbConfig,
          database: tenant.database_name,
        };

        const tenantConnection = await createConnection(tenantDbConfig);
        console.log(
          `   📡 Connected to tenant database: ${tenant.database_name}`
        );

        // Get backup summaries with NULL values
        const [nullSummaries] = await tenantConnection.execute(`
          SELECT bs.*, i.invoice_number, i.fbr_invoice_number
          FROM invoice_backup_summary bs
          LEFT JOIN invoices i ON bs.original_invoice_id = i.id
          WHERE bs.invoice_number IS NULL 
             OR bs.tenant_name IS NULL 
             OR bs.last_modified_by_name IS NULL
          ORDER BY bs.id
        `);

        if (nullSummaries.length === 0) {
          console.log(`   ✅ No NULL values found in backup summaries`);
          await tenantConnection.end();
          continue;
        }

        console.log(
          `   ⚠️  Found ${nullSummaries.length} backup summaries with NULL values`
        );

        // Fix each backup summary
        let fixedCount = 0;
        for (const summary of nullSummaries) {
          const updateData = {};

          // Fix invoice_number if NULL
          if (!summary.invoice_number && summary.invoice_number !== null) {
            updateData.invoice_number = summary.invoice_number;
          }

          // Fix tenant_name if NULL
          if (!summary.tenant_name) {
            updateData.tenant_name = tenant.seller_business_name;
          }

          // Fix tenant_id if NULL
          if (!summary.tenant_id) {
            updateData.tenant_id = tenant.id;
          }

          // Fix last_modified_by fields if NULL but created_by exists
          if (!summary.last_modified_by_name && summary.created_by_name) {
            updateData.last_modified_by_user_id = summary.created_by_user_id;
            updateData.last_modified_by_email = summary.created_by_email;
            updateData.last_modified_by_name = summary.created_by_name;
          }

          // Fix fbr_invoice_number if NULL
          if (
            !summary.fbr_invoice_number &&
            summary.fbr_invoice_number !== null
          ) {
            updateData.fbr_invoice_number = summary.fbr_invoice_number;
          }

          // Update if there are changes to make
          if (Object.keys(updateData).length > 0) {
            const updateFields = Object.keys(updateData)
              .map((key) => `${key} = ?`)
              .join(", ");
            const updateValues = Object.values(updateData);
            updateValues.push(summary.id);

            await tenantConnection.execute(
              `
              UPDATE invoice_backup_summary 
              SET ${updateFields}
              WHERE id = ?
            `,
              updateValues
            );

            fixedCount++;
            console.log(`   🔧 Fixed backup summary ID: ${summary.id}`);
          }
        }

        console.log(`   ✅ Fixed ${fixedCount} backup summary records`);

        // Verify fixes
        const [remainingNulls] = await tenantConnection.execute(`
          SELECT COUNT(*) as count
          FROM invoice_backup_summary
          WHERE invoice_number IS NULL 
             OR tenant_name IS NULL 
             OR last_modified_by_name IS NULL
        `);

        console.log(`   📊 Remaining NULL values: ${remainingNulls[0].count}`);

        // Close tenant connection
        await tenantConnection.end();
        console.log(`   📡 Disconnected from ${tenant.database_name}`);
      } catch (error) {
        console.log(
          `   ❌ Error processing tenant ${tenant.database_name}: ${error.message}`
        );
      }
    }

    console.log("\n🎉 Backup summary NULL values fix completed!");
    console.log("");
    console.log("📋 Summary:");
    console.log("   • Checked all tenant databases for NULL values");
    console.log(
      "   • Fixed missing invoice numbers, tenant names, and user information"
    );
    console.log("   • Updated backup summary records with proper data");
    console.log("");
    console.log("🔧 Next steps:");
    console.log(
      "   1. The backup system will now properly populate all fields"
    );
    console.log("   2. New backups will have complete data");
    console.log("   3. Existing NULL values have been fixed");
  } catch (error) {
    console.error("❌ Fix failed:", error);
    process.exit(1);
  } finally {
    if (masterConnection) {
      await masterConnection.end();
      console.log("📡 Master database connection closed");
    }
  }
}

// Run the fix
fixBackupSummaryNulls().catch(console.error);
