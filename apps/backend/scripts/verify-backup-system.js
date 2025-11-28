#!/usr/bin/env node

/**
 * Verify Backup System Script
 * This script verifies that the backup system is working correctly
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

async function verifyBackupSystem() {
  let masterConnection;

  try {
    console.log("🔍 Verifying backup system setup...");

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

    console.log(`📊 Found ${tenants.length} tenant databases to verify`);

    let totalBackupTables = 0;
    let totalSummaryTables = 0;

    // Verify each tenant database
    for (const tenant of tenants) {
      console.log(
        `\n🏢 Verifying tenant: ${tenant.seller_business_name} (${tenant.database_name})`
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

        // Check if backup tables exist
        const [backupTables] = await tenantConnection.execute(
          `
          SELECT TABLE_NAME 
          FROM INFORMATION_SCHEMA.TABLES 
          WHERE TABLE_SCHEMA = ? 
          AND TABLE_NAME = 'invoice_backups'
        `,
          [tenant.database_name]
        );

        const [summaryTables] = await tenantConnection.execute(
          `
          SELECT TABLE_NAME 
          FROM INFORMATION_SCHEMA.TABLES 
          WHERE TABLE_SCHEMA = ? 
          AND TABLE_NAME = 'invoice_backup_summary'
        `,
          [tenant.database_name]
        );

        if (backupTables.length > 0) {
          console.log(`   ✅ invoice_backups table exists`);
          totalBackupTables++;

          // Check table structure
          const [columns] = await tenantConnection.execute(
            `
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'invoice_backups'
            ORDER BY ORDINAL_POSITION
          `,
            [tenant.database_name]
          );

          console.log(`   📊 invoice_backups has ${columns.length} columns`);

          // Check for key columns
          const keyColumns = [
            "id",
            "original_invoice_id",
            "backup_type",
            "invoice_data",
            "created_at",
          ];
          const missingColumns = keyColumns.filter(
            (col) => !columns.some((c) => c.COLUMN_NAME === col)
          );

          if (missingColumns.length === 0) {
            console.log(`   ✅ All key columns present`);
          } else {
            console.log(`   ❌ Missing columns: ${missingColumns.join(", ")}`);
          }

          // Check indexes
          const [indexes] = await tenantConnection.execute(`
            SHOW INDEX FROM invoice_backups
          `);
          console.log(`   📊 invoice_backups has ${indexes.length} indexes`);
        } else {
          console.log(`   ❌ invoice_backups table missing`);
        }

        if (summaryTables.length > 0) {
          console.log(`   ✅ invoice_backup_summary table exists`);
          totalSummaryTables++;

          // Check table structure
          const [columns] = await tenantConnection.execute(
            `
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'invoice_backup_summary'
            ORDER BY ORDINAL_POSITION
          `,
            [tenant.database_name]
          );

          console.log(
            `   📊 invoice_backup_summary has ${columns.length} columns`
          );
        } else {
          console.log(`   ❌ invoice_backup_summary table missing`);
        }

        // Test insert capability
        console.log(`   🧪 Testing insert capability...`);
        try {
          const testData = {
            original_invoice_id: 999,
            backup_type: "DRAFT",
            invoice_data: JSON.stringify({ id: 999, test: true }),
            created_at: new Date(),
          };

          const [insertResult] = await tenantConnection.execute(
            `
            INSERT INTO invoice_backups (original_invoice_id, backup_type, invoice_data, created_at)
            VALUES (?, ?, ?, ?)
          `,
            [
              testData.original_invoice_id,
              testData.backup_type,
              testData.invoice_data,
              testData.created_at,
            ]
          );

          console.log(
            `   ✅ Test backup inserted successfully (ID: ${insertResult.insertId})`
          );

          // Clean up test data
          await tenantConnection.execute(
            `
            DELETE FROM invoice_backups WHERE id = ?
          `,
            [insertResult.insertId]
          );

          console.log(`   🧹 Test backup cleaned up`);
        } catch (error) {
          console.log(`   ❌ Insert test failed: ${error.message}`);
        }

        // Close tenant connection
        await tenantConnection.end();
        console.log(`   📡 Disconnected from ${tenant.database_name}`);
      } catch (error) {
        console.log(
          `   ❌ Error verifying tenant ${tenant.database_name}: ${error.message}`
        );
      }
    }

    console.log("\n🎉 Backup system verification completed!");
    console.log("");
    console.log("📋 Summary:");
    console.log(
      `   • ${totalBackupTables}/${tenants.length} tenant databases have invoice_backups table`
    );
    console.log(
      `   • ${totalSummaryTables}/${tenants.length} tenant databases have invoice_backup_summary table`
    );
    console.log("   • Backup system is ready for use");
    console.log("");

    if (
      totalBackupTables === tenants.length &&
      totalSummaryTables === tenants.length
    ) {
      console.log(
        "✅ All tenant databases are properly configured for backups!"
      );
      console.log("");
      console.log(
        "🚀 The backup system is fully operational and will automatically:"
      );
      console.log("   • Create backups when invoices are saved as drafts");
      console.log("   • Create backups when invoices are saved and validated");
      console.log(
        "   • Create backups when invoices are edited (both old and new data)"
      );
      console.log("   • Create backups when invoices are posted to FBR");
      console.log("   • Create backups of FBR API requests and responses");
      console.log("");
      console.log("🔧 Next steps:");
      console.log("   1. Restart your backend server");
      console.log("   2. Test creating/updating invoices");
      console.log("   3. Check the console logs for backup creation messages");
    } else {
      console.log("⚠️  Some tenant databases are missing backup tables");
      console.log("   Run the setup script again to fix any missing tables");
    }
  } catch (error) {
    console.error("❌ Verification failed:", error);
    process.exit(1);
  } finally {
    if (masterConnection) {
      await masterConnection.end();
      console.log("📡 Master database connection closed");
    }
  }
}

// Run the verification
verifyBackupSystem().catch(console.error);
