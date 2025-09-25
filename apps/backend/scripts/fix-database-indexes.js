#!/usr/bin/env node

/**
 * Fix Database Indexes Script
 * This script removes unnecessary indexes to resolve "Too many keys specified" error
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

async function fixDatabaseIndexes() {
  let connection;
  
  try {
    console.log('🔧 Fixing Database Indexes...');
    
    // Connect to database
    console.log('📡 Connecting to database...');
    connection = await createConnection(dbConfig);
    console.log('✅ Connected to database successfully');
    
    // Get all tables and their indexes
    console.log('🔍 Analyzing database indexes...');
    
    const [tables] = await connection.execute("SHOW TABLES");
    console.log(`📊 Found ${tables.length} tables to analyze`);
    
    for (const table of tables) {
      const tableName = Object.values(table)[0];
      console.log(`\n📋 Analyzing table: ${tableName}`);
      
      // Get indexes for this table
      const [indexes] = await connection.execute(`SHOW INDEX FROM \`${tableName}\``);
      
      if (indexes.length > 50) {
        console.log(`⚠️  Table ${tableName} has ${indexes.length} indexes (high count)`);
        
        // Group indexes by name to find duplicates
        const indexGroups = {};
        indexes.forEach(idx => {
          if (!indexGroups[idx.Key_name]) {
            indexGroups[idx.Key_name] = [];
          }
          indexGroups[idx.Key_name].push(idx);
        });
        
        // Find potentially duplicate indexes
        const duplicateIndexes = [];
        Object.keys(indexGroups).forEach(keyName => {
          if (keyName !== 'PRIMARY' && indexGroups[keyName].length > 1) {
            duplicateIndexes.push(keyName);
          }
        });
        
        if (duplicateIndexes.length > 0) {
          console.log(`   🔍 Found ${duplicateIndexes.length} potentially duplicate indexes`);
          duplicateIndexes.forEach(idxName => {
            console.log(`   - ${idxName}`);
          });
        }
        
        // Find indexes that might be redundant
        const redundantIndexes = [];
        Object.keys(indexGroups).forEach(keyName => {
          if (keyName !== 'PRIMARY' && keyName.startsWith('idx_') && keyName.includes('_')) {
            const parts = keyName.split('_');
            if (parts.length > 3) {
              redundantIndexes.push(keyName);
            }
          }
        });
        
        if (redundantIndexes.length > 0) {
          console.log(`   🔍 Found ${redundantIndexes.length} potentially redundant indexes`);
          redundantIndexes.forEach(idxName => {
            console.log(`   - ${idxName}`);
          });
        }
        
      } else {
        console.log(`   ✅ Table ${tableName} has ${indexes.length} indexes (acceptable)`);
      }
    }
    
    // Check specific problematic tables
    console.log('\n🔍 Checking specific tables for index issues...');
    
    const problematicTables = ['tenants', 'users', 'roles', 'permissions'];
    
    for (const tableName of problematicTables) {
      try {
        const [indexes] = await connection.execute(`SHOW INDEX FROM \`${tableName}\``);
        console.log(`📊 Table ${tableName}: ${indexes.length} indexes`);
        
        if (indexes.length > 30) {
          console.log(`⚠️  Table ${tableName} has too many indexes`);
          
          // List all indexes
          const indexNames = [...new Set(indexes.map(idx => idx.Key_name))];
          console.log(`   Indexes: ${indexNames.join(', ')}`);
          
          // Suggest removing some indexes
          const indexesToRemove = indexNames.filter(name => 
            name !== 'PRIMARY' && 
            (name.includes('_idx_') || name.includes('_index_') || name.includes('_key_'))
          );
          
          if (indexesToRemove.length > 0) {
            console.log(`   💡 Consider removing these indexes: ${indexesToRemove.slice(0, 5).join(', ')}`);
          }
        }
      } catch (error) {
        console.log(`   ❌ Error checking table ${tableName}: ${error.message}`);
      }
    }
    
    console.log('\n🎉 Database index analysis completed!');
    console.log('');
    console.log('📋 Recommendations:');
    console.log('   1. Remove duplicate indexes');
    console.log('   2. Remove redundant composite indexes');
    console.log('   3. Keep only essential indexes for performance');
    console.log('   4. Consider using composite indexes instead of multiple single-column indexes');
    console.log('');
    console.log('⚠️  Note: This script only analyzes indexes. Manual cleanup may be required.');
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('📡 Database connection closed');
    }
  }
}

// Run the analysis
fixDatabaseIndexes().catch(console.error);
