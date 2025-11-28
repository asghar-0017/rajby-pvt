#!/usr/bin/env node

/**
 * Fix User References Script
 * This script fixes user reference issues in the database
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

async function fixUserReferences() {
  let connection;

  try {
    console.log("🔧 Fixing user reference issues...");

    // Connect to database
    console.log("📡 Connecting to database...");
    connection = await createConnection(masterDbConfig);
    console.log("✅ Connected to database successfully");

    // Check if user ID 5 exists
    console.log("🔍 Checking if user ID 5 exists...");
    const [users] = await connection.execute(`
      SELECT id, email, first_name, last_name, role_id
      FROM users 
      WHERE id = 5
    `);

    if (users.length === 0) {
      console.log("⚠️  User ID 5 does not exist. Creating a system user...");

      // Create a system user
      const [insertResult] = await connection.execute(`
        INSERT INTO users (id, email, password, first_name, last_name, role_id, is_active, is_verified, created_at, updated_at)
        VALUES (5, 'system@fbr.com', '$2b$12$systemuserpasswordhash', 'System', 'User', NULL, 1, 1, NOW(), NOW())
      `);

      console.log(`✅ Created system user with ID: ${insertResult.insertId}`);
    } else {
      console.log(
        `✅ User ID 5 exists: ${users[0].email} (${users[0].first_name} ${users[0].last_name})`
      );
    }

    // Check for any other missing user references
    console.log("\n🔍 Checking for other missing user references...");
    const [missingUsers] = await connection.execute(`
      SELECT DISTINCT al.user_id, al.user_email, al.user_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.user_id IS NOT NULL AND u.id IS NULL
      LIMIT 10
    `);

    if (missingUsers.length > 0) {
      console.log(
        `⚠️  Found ${missingUsers.length} audit logs with missing user references:`
      );
      missingUsers.forEach((user) => {
        console.log(
          `   - User ID: ${user.user_id}, Email: ${user.user_email}, Name: ${user.user_name}`
        );
      });

      // Fix by setting user_id to NULL for missing users
      console.log("🔧 Fixing missing user references in audit logs...");
      const [updateResult] = await connection.execute(`
        UPDATE audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        SET al.user_id = NULL
        WHERE al.user_id IS NOT NULL AND u.id IS NULL
      `);

      console.log(`✅ Fixed ${updateResult.affectedRows} audit log entries`);
    } else {
      console.log("✅ No missing user references found in audit logs");
    }

    // Check backup tables for missing user references
    console.log("\n🔍 Checking backup tables for missing user references...");
    const [missingBackupUsers] = await connection.execute(`
      SELECT DISTINCT ib.user_id, ib.user_email, ib.user_name
      FROM invoice_backups ib
      LEFT JOIN users u ON ib.user_id = u.id
      WHERE ib.user_id IS NOT NULL AND u.id IS NULL
      LIMIT 10
    `);

    if (missingBackupUsers.length > 0) {
      console.log(
        `⚠️  Found ${missingBackupUsers.length} backup records with missing user references:`
      );
      missingBackupUsers.forEach((user) => {
        console.log(
          `   - User ID: ${user.user_id}, Email: ${user.user_email}, Name: ${user.user_name}`
        );
      });

      // Fix by setting user_id to NULL for missing users
      console.log("🔧 Fixing missing user references in backup records...");
      const [updateResult] = await connection.execute(`
        UPDATE invoice_backups ib
        LEFT JOIN users u ON ib.user_id = u.id
        SET ib.user_id = NULL
        WHERE ib.user_id IS NOT NULL AND u.id IS NULL
      `);

      console.log(`✅ Fixed ${updateResult.affectedRows} backup records`);
    } else {
      console.log("✅ No missing user references found in backup records");
    }

    // Verify user ID 5 exists now
    console.log("\n🔍 Verifying user ID 5 exists...");
    const [verifyUsers] = await connection.execute(`
      SELECT id, email, first_name, last_name, role_id
      FROM users 
      WHERE id = 5
    `);

    if (verifyUsers.length > 0) {
      console.log(
        `✅ User ID 5 verified: ${verifyUsers[0].email} (${verifyUsers[0].first_name} ${verifyUsers[0].last_name})`
      );
    } else {
      console.log("❌ User ID 5 still does not exist");
    }

    console.log("\n🎉 User reference fix completed!");
    console.log("");
    console.log("📋 Summary:");
    console.log("   • Checked for missing user references");
    console.log("   • Created system user if needed");
    console.log(
      "   • Fixed orphaned references in audit logs and backup records"
    );
    console.log("   • Verified user ID 5 exists");
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
fixUserReferences().catch(console.error);
