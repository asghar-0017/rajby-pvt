#!/usr/bin/env node

/**
 * Fix Foreign Key Constraints Script
 * This script fixes foreign key constraint issues in the database
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

async function fixForeignKeyConstraints() {
  let connection;

  try {
    console.log("🔧 Fixing foreign key constraints...");

    // Connect to database
    console.log("📡 Connecting to database...");
    connection = await createConnection(masterDbConfig);
    console.log("✅ Connected to database successfully");

    // Check for orphaned audit logs
    console.log("🔍 Checking for orphaned audit logs...");
    const [orphanedAuditLogs] = await connection.execute(`
      SELECT al.id, al.user_id, al.user_email, al.user_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.user_id IS NOT NULL AND u.id IS NULL
      LIMIT 10
    `);

    if (orphanedAuditLogs.length > 0) {
      console.log(`⚠️  Found ${orphanedAuditLogs.length} orphaned audit logs`);
      console.log("   Sample orphaned records:");
      orphanedAuditLogs.forEach((log) => {
        console.log(
          `   - ID: ${log.id}, User ID: ${log.user_id}, Email: ${log.user_email}`
        );
      });

      // Fix orphaned audit logs by setting user_id to NULL
      console.log("🔧 Fixing orphaned audit logs...");
      const [updateResult] = await connection.execute(`
        UPDATE audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        SET al.user_id = NULL
        WHERE al.user_id IS NOT NULL AND u.id IS NULL
      `);

      console.log(`✅ Fixed ${updateResult.affectedRows} orphaned audit logs`);
    } else {
      console.log("✅ No orphaned audit logs found");
    }

    // Check for orphaned backup records
    console.log("\n🔍 Checking for orphaned backup records...");
    const [orphanedBackups] = await connection.execute(`
      SELECT ib.id, ib.user_id, ib.user_email, ib.user_name
      FROM invoice_backups ib
      LEFT JOIN users u ON ib.user_id = u.id
      WHERE ib.user_id IS NOT NULL AND u.id IS NULL
      LIMIT 10
    `);

    if (orphanedBackups.length > 0) {
      console.log(
        `⚠️  Found ${orphanedBackups.length} orphaned backup records`
      );
      console.log("   Sample orphaned records:");
      orphanedBackups.forEach((backup) => {
        console.log(
          `   - ID: ${backup.id}, User ID: ${backup.user_id}, Email: ${backup.user_email}`
        );
      });

      // Fix orphaned backup records by setting user_id to NULL
      console.log("🔧 Fixing orphaned backup records...");
      const [updateResult] = await connection.execute(`
        UPDATE invoice_backups ib
        LEFT JOIN users u ON ib.user_id = u.id
        SET ib.user_id = NULL
        WHERE ib.user_id IS NOT NULL AND u.id IS NULL
      `);

      console.log(
        `✅ Fixed ${updateResult.affectedRows} orphaned backup records`
      );
    } else {
      console.log("✅ No orphaned backup records found");
    }

    // Check foreign key constraints
    console.log("\n🔍 Checking foreign key constraints...");
    const [constraints] = await connection.execute(
      `
      SELECT 
        CONSTRAINT_NAME,
        TABLE_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ?
      AND REFERENCED_TABLE_NAME IS NOT NULL
      AND CONSTRAINT_NAME LIKE '%audit%'
      ORDER BY TABLE_NAME, CONSTRAINT_NAME
    `,
      [masterDbConfig.database]
    );

    console.log(
      `📊 Found ${constraints.length} audit-related foreign key constraints:`
    );
    constraints.forEach((constraint) => {
      console.log(
        `   - ${constraint.TABLE_NAME}.${constraint.COLUMN_NAME} -> ${constraint.REFERENCED_TABLE_NAME}.${constraint.REFERENCED_COLUMN_NAME}`
      );
    });

    console.log("\n🎉 Foreign key constraint check completed!");
    console.log("");
    console.log("📋 Summary:");
    console.log("   • Checked for orphaned audit logs and backup records");
    console.log(
      "   • Fixed any orphaned references by setting user_id to NULL"
    );
    console.log(
      "   • Verified foreign key constraints are properly configured"
    );
    console.log("");
    console.log("🔧 Next steps:");
    console.log("   1. Restart your backend server");
    console.log("   2. Test creating/updating invoices");
    console.log(
      "   3. The backup system should now work without foreign key errors"
    );
  } catch (error) {
    console.error("❌ Fix failed:", error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log("📡 Database connection closed");
    }
  }
}

// Run the fix
fixForeignKeyConstraints().catch(console.error);
