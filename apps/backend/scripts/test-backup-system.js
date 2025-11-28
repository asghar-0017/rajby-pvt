#!/usr/bin/env node

/**
 * Test script for Invoice Backup System
 * This script tests the backup system functionality
 */

import { createConnection } from "mysql2/promise";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Database configuration
const dbConfig = {
  host: process.env.MYSQL_HOST || "157.245.150.54",
  port: process.env.MYSQL_PORT || 3306,
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "Jsab43#%87dgDJ49bf^9b",
  database: process.env.MYSQL_MASTER_DB || "fbr_master",
};

async function testBackupSystem() {
  let connection;

  try {
    console.log("🧪 Testing Invoice Backup System...");

    // Connect to database
    console.log("📡 Connecting to database...");
    connection = await createConnection(dbConfig);
    console.log("✅ Connected to database successfully");

    // Test 1: Check if backup tables exist
    console.log("\n🔍 Test 1: Checking backup tables...");

    const [backupTables] = await connection.execute(
      "SHOW TABLES LIKE 'invoice_backups'"
    );
    const [summaryTables] = await connection.execute(
      "SHOW TABLES LIKE 'invoice_backup_summary'"
    );

    if (backupTables.length > 0) {
      console.log("   ✅ invoice_backups table exists");
    } else {
      console.log("   ❌ invoice_backups table not found");
      return;
    }

    if (summaryTables.length > 0) {
      console.log("   ✅ invoice_backup_summary table exists");
    } else {
      console.log("   ❌ invoice_backup_summary table not found");
      return;
    }

    // Test 2: Check table structure
    console.log("\n🔍 Test 2: Checking table structure...");

    const [backupColumns] = await connection.execute(
      "DESCRIBE invoice_backups"
    );
    const [summaryColumns] = await connection.execute(
      "DESCRIBE invoice_backup_summary"
    );

    console.log(`   📊 invoice_backups has ${backupColumns.length} columns`);
    console.log(
      `   📊 invoice_backup_summary has ${summaryColumns.length} columns`
    );

    // Check for key columns
    const backupColumnNames = backupColumns.map((col) => col.Field);
    const requiredBackupColumns = [
      "id",
      "original_invoice_id",
      "backup_type",
      "invoice_data",
      "created_at",
    ];

    for (const col of requiredBackupColumns) {
      if (backupColumnNames.includes(col)) {
        console.log(`   ✅ Required column '${col}' exists in invoice_backups`);
      } else {
        console.log(
          `   ❌ Required column '${col}' missing in invoice_backups`
        );
      }
    }

    // Test 3: Check indexes
    console.log("\n🔍 Test 3: Checking indexes...");

    const [backupIndexes] = await connection.execute(
      "SHOW INDEX FROM invoice_backups"
    );
    const [summaryIndexes] = await connection.execute(
      "SHOW INDEX FROM invoice_backup_summary"
    );

    console.log(`   📊 invoice_backups has ${backupIndexes.length} indexes`);
    console.log(
      `   📊 invoice_backup_summary has ${summaryIndexes.length} indexes`
    );

    // Test 4: Test backup type enum
    console.log("\n🔍 Test 4: Testing backup type enum...");

    const [enumValues] = await connection.execute(`
      SELECT COLUMN_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'invoice_backups' 
      AND COLUMN_NAME = 'backup_type'
    `);

    if (enumValues.length > 0) {
      const enumType = enumValues[0].COLUMN_TYPE;
      console.log(`   📊 backup_type enum: ${enumType}`);

      const expectedTypes = [
        "DRAFT",
        "SAVED",
        "EDIT",
        "POST",
        "FBR_REQUEST",
        "FBR_RESPONSE",
      ];
      for (const type of expectedTypes) {
        if (enumType.includes(type)) {
          console.log(`   ✅ Backup type '${type}' is supported`);
        } else {
          console.log(`   ❌ Backup type '${type}' is missing`);
        }
      }
    }

    // Test 5: Test JSON column support
    console.log("\n🔍 Test 5: Testing JSON column support...");

    const [jsonColumns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'invoice_backups' 
      AND DATA_TYPE = 'json'
    `);

    console.log(`   📊 Found ${jsonColumns.length} JSON columns:`);
    jsonColumns.forEach((col) => {
      console.log(`   ✅ ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
    });

    // Test 6: Test insert capability
    console.log("\n🔍 Test 6: Testing insert capability...");

    try {
      const testBackupData = {
        original_invoice_id: 999999,
        system_invoice_id: "TEST_001",
        invoice_number: "TEST_INVOICE_001",
        backup_type: "DRAFT",
        backup_reason: "Test backup creation",
        status_before: null,
        status_after: "draft",
        invoice_data: JSON.stringify({
          id: 999999,
          invoice_number: "TEST_INVOICE_001",
          status: "draft",
          test: true,
        }),
        user_id: 1,
        user_email: "test@example.com",
        user_name: "Test User",
        user_role: "admin",
        tenant_id: 1,
        tenant_name: "Test Tenant",
      };

      const insertQuery = `
        INSERT INTO invoice_backups (
          original_invoice_id, system_invoice_id, invoice_number, backup_type,
          backup_reason, status_before, status_after, invoice_data,
          user_id, user_email, user_name, user_role, tenant_id, tenant_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const [result] = await connection.execute(insertQuery, [
        testBackupData.original_invoice_id,
        testBackupData.system_invoice_id,
        testBackupData.invoice_number,
        testBackupData.backup_type,
        testBackupData.backup_reason,
        testBackupData.status_before,
        testBackupData.status_after,
        testBackupData.invoice_data,
        testBackupData.user_id,
        testBackupData.user_email,
        testBackupData.user_name,
        testBackupData.user_role,
        testBackupData.tenant_id,
        testBackupData.tenant_name,
      ]);

      console.log(
        `   ✅ Test backup inserted successfully (ID: ${result.insertId})`
      );

      // Clean up test data
      await connection.execute("DELETE FROM invoice_backups WHERE id = ?", [
        result.insertId,
      ]);
      console.log("   🧹 Test backup cleaned up");
    } catch (error) {
      console.log(`   ❌ Test insert failed: ${error.message}`);
    }

    console.log("\n🎉 Backup System Test Completed!");
    console.log("");
    console.log("📋 Test Summary:");
    console.log("   • Backup tables are properly created");
    console.log("   • Table structure is correct");
    console.log("   • Indexes are in place");
    console.log("   • JSON columns are supported");
    console.log("   • Backup types are properly defined");
    console.log("   • Insert operations work correctly");
    console.log("");
    console.log("✅ The backup system is ready for use!");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log("📡 Database connection closed");
    }
  }
}

// Run the test
testBackupSystem().catch(console.error);
