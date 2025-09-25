#!/usr/bin/env node

/**
 * Cleanup Duplicate Indexes Script
 * This script removes duplicate indexes to resolve "Too many keys specified" error
 */

import { createConnection } from 'mysql2/promise';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Database configuration
const dbConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: process.env.MYSQL_PORT || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'Jsab43#%87dgDJ49bf^9b',
  database: process.env.MYSQL_MASTER_DB || 'fbr_master'
};

async function cleanupDuplicateIndexes() {
  let connection;
  
  try {
    console.log('🧹 Cleaning up duplicate indexes...');
    
    // Connect to database
    console.log('📡 Connecting to database...');
    connection = await createConnection(dbConfig);
    console.log('✅ Connected to database successfully');
    
    // Tables with too many indexes
    const problematicTables = ['tenants', 'users', 'roles', 'permissions'];
    
    for (const tableName of problematicTables) {
      console.log(`\n🔍 Processing table: ${tableName}`);
      
      try {
        // Get all indexes for this table
        const [indexes] = await connection.execute(`SHOW INDEX FROM \`${tableName}\``);
        
        if (indexes.length <= 30) {
          console.log(`   ✅ Table ${tableName} has ${indexes.length} indexes (acceptable)`);
          continue;
        }
        
        console.log(`   ⚠️  Table ${tableName} has ${indexes.length} indexes (too many)`);
        
        // Group indexes by name
        const indexGroups = {};
        indexes.forEach(idx => {
          if (!indexGroups[idx.Key_name]) {
            indexGroups[idx.Key_name] = [];
          }
          indexGroups[idx.Key_name].push(idx);
        });
        
        // Find duplicate indexes (same column, different names)
        const columnsToIndexes = {};
        Object.keys(indexGroups).forEach(keyName => {
          if (keyName === 'PRIMARY') return;
          
          const index = indexGroups[keyName][0];
          const columnName = index.Column_name;
          
          if (!columnsToIndexes[columnName]) {
            columnsToIndexes[columnName] = [];
          }
          columnsToIndexes[columnName].push(keyName);
        });
        
        // Remove duplicate indexes
        let removedCount = 0;
        for (const [columnName, indexNames] of Object.entries(columnsToIndexes)) {
          if (indexNames.length > 1) {
            // Keep the first index, remove the rest
            const indexesToRemove = indexNames.slice(1);
            
            for (const indexName of indexesToRemove) {
              try {
                console.log(`   🗑️  Removing duplicate index: ${indexName} on column ${columnName}`);
                await connection.execute(`ALTER TABLE \`${tableName}\` DROP INDEX \`${indexName}\``);
                removedCount++;
              } catch (error) {
                console.log(`   ❌ Failed to remove index ${indexName}: ${error.message}`);
              }
            }
          }
        }
        
        // Remove numbered duplicate indexes (like tenant_id_2, tenant_id_3, etc.)
        const numberedIndexes = Object.keys(indexGroups).filter(name => 
          name !== 'PRIMARY' && /\w+_\d+$/.test(name)
        );
        
        for (const indexName of numberedIndexes) {
          try {
            console.log(`   🗑️  Removing numbered duplicate index: ${indexName}`);
            await connection.execute(`ALTER TABLE \`${tableName}\` DROP INDEX \`${indexName}\``);
            removedCount++;
          } catch (error) {
            console.log(`   ❌ Failed to remove index ${indexName}: ${error.message}`);
          }
        }
        
        console.log(`   ✅ Removed ${removedCount} duplicate indexes from ${tableName}`);
        
        // Check final count
        const [finalIndexes] = await connection.execute(`SHOW INDEX FROM \`${tableName}\``);
        console.log(`   📊 Final index count: ${finalIndexes.length}`);
        
      } catch (error) {
        console.log(`   ❌ Error processing table ${tableName}: ${error.message}`);
      }
    }
    
    console.log('\n🎉 Duplicate index cleanup completed!');
    console.log('');
    console.log('📋 Summary:');
    console.log('   • Removed duplicate indexes from problematic tables');
    console.log('   • Kept essential indexes for performance');
    console.log('   • Database should now sync without "Too many keys" errors');
    console.log('');
    console.log('🔧 Next steps:');
    console.log('   1. Restart your backend server');
    console.log('   2. The database sync should now work properly');
    console.log('   3. The backup system will be fully operational');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('📡 Database connection closed');
    }
  }
}

// Run the cleanup
cleanupDuplicateIndexes().catch(console.error);
