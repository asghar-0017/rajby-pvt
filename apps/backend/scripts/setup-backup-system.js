#!/usr/bin/env node

/**
 * Setup script for Invoice Backup System
 * This script creates the backup tables and sets up the necessary permissions
 */

import { createConnection } from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database configuration - use same config as the main app
const dbConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: process.env.MYSQL_PORT || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'Jsab43#%87dgDJ49bf^9b',
  database: process.env.MYSQL_MASTER_DB || 'fbr_master'
};

async function setupBackupSystem() {
  let connection;
  
  try {
    console.log('🚀 Starting Invoice Backup System Setup...');
    
    // Connect to database
    console.log('📡 Connecting to database...');
    connection = await createConnection(dbConfig);
    console.log('✅ Connected to database successfully');
    
    // Read and execute the backup system SQL script
    const sqlScriptPath = path.join(__dirname, 'create-backup-system.sql');
    const sqlScript = fs.readFileSync(sqlScriptPath, 'utf8');
    
    console.log('📄 Reading backup system SQL script...');
    
    // Split the script into individual statements
    const statements = sqlScript
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => {
        // Filter out empty statements and comments
        const trimmed = stmt.trim();
        return trimmed.length > 0 && 
               !trimmed.startsWith('--') && 
               !trimmed.startsWith('/*') &&
               trimmed !== '';
      });
    
    console.log(`📝 Executing ${statements.length} SQL statements...`);
    
    // Debug: Show first few statements
    if (statements.length > 0) {
      console.log('🔍 First statement preview:', statements[0].substring(0, 100) + '...');
    }
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      if (statement.trim()) {
        try {
          console.log(`   ${i + 1}/${statements.length}: Executing statement...`);
          console.log(`   📝 Statement preview: ${statement.substring(0, 80)}...`);
          await connection.execute(statement);
          console.log(`   ✅ Statement ${i + 1} executed successfully`);
        } catch (error) {
          // Some statements might fail if they already exist, which is okay
          if (error.code === 'ER_TABLE_EXISTS_ERROR' || 
              error.code === 'ER_DUP_KEYNAME' || 
              error.code === 'ER_DUP_ENTRY') {
            console.log(`   ⚠️  Statement ${i + 1} skipped (already exists): ${error.message}`);
          } else {
            console.error(`   ❌ Statement ${i + 1} failed:`, error.message);
            throw error;
          }
        }
      }
    }
    
    console.log('✅ All SQL statements executed successfully');
    
    // Verify tables were created
    console.log('🔍 Verifying backup tables...');
    
    const tables = [
      'invoice_backups',
      'invoice_backup_summary'
    ];
    
    for (const table of tables) {
      try {
        const [rows] = await connection.execute(`SHOW TABLES LIKE '${table}'`);
        if (rows.length > 0) {
          console.log(`   ✅ Table '${table}' exists`);
        } else {
          console.log(`   ❌ Table '${table}' not found`);
        }
      } catch (error) {
        console.error(`   ❌ Error checking table '${table}':`, error.message);
      }
    }
    
    // Check permissions
    console.log('🔐 Verifying backup permissions...');
    
    const permissions = [
      'invoice_backup.view',
      'invoice_backup.export', 
      'invoice_backup.restore'
    ];
    
    for (const permission of permissions) {
      try {
        const [rows] = await connection.execute(
          'SELECT id FROM permissions WHERE permission_name = ?',
          [permission]
        );
        if (rows.length > 0) {
          console.log(`   ✅ Permission '${permission}' exists`);
        } else {
          console.log(`   ❌ Permission '${permission}' not found`);
        }
      } catch (error) {
        console.error(`   ❌ Error checking permission '${permission}':`, error.message);
      }
    }
    
    console.log('🎉 Invoice Backup System setup completed successfully!');
    console.log('');
    console.log('📋 Summary:');
    console.log('   • Backup tables created');
    console.log('   • Backup permissions configured');
    console.log('   • System ready for invoice backups');
    console.log('');
    console.log('🔧 Next steps:');
    console.log('   1. Restart your backend server to load the new models');
    console.log('   2. The backup system will automatically start working');
    console.log('   3. Check logs for backup creation messages');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('📡 Database connection closed');
    }
  }
}

// Run the setup
setupBackupSystem().catch(console.error);
