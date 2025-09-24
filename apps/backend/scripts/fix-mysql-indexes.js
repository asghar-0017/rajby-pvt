#!/usr/bin/env node

/**
 * Fix MySQL Index Issues
 * 
 * This script fixes the "Too many keys specified; max 64 keys allowed" error
 * by cleaning up duplicate or unnecessary indexes.
 */

import { masterSequelize } from '../src/config/mysql.js';
import dotenv from 'dotenv';

dotenv.config();

class MySQLIndexFixer {
  constructor() {
    this.removedIndexes = [];
    this.errors = [];
  }

  async connect() {
    try {
      await masterSequelize.authenticate();
      console.log('✅ Connected to database');
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      return false;
    }
  }

  async getTableIndexes(tableName) {
    try {
      const [results] = await masterSequelize.query(
        `SELECT 
          INDEX_NAME,
          COLUMN_NAME,
          NON_UNIQUE,
          INDEX_TYPE
        FROM information_schema.STATISTICS 
        WHERE table_schema = DATABASE() 
        AND table_name = ? 
        ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
        { replacements: [tableName] }
      );
      return results;
    } catch (error) {
      console.error(`Error getting indexes for ${tableName}:`, error.message);
      return [];
    }
  }

  async removeDuplicateIndexes(tableName) {
    console.log(`\n🔍 Checking indexes for table: ${tableName}`);
    
    const indexes = await this.getTableIndexes(tableName);
    
    if (indexes.length === 0) {
      console.log(`   No indexes found for ${tableName}`);
      return;
    }

    // Group indexes by name
    const indexGroups = {};
    indexes.forEach(index => {
      if (!indexGroups[index.INDEX_NAME]) {
        indexGroups[index.INDEX_NAME] = [];
      }
      indexGroups[index.INDEX_NAME].push(index);
    });

    // Find and remove duplicate indexes
    const seenIndexes = new Set();
    
    for (const [indexName, indexColumns] of Object.entries(indexGroups)) {
      // Skip primary key and unique constraints
      if (indexName === 'PRIMARY' || indexColumns[0].NON_UNIQUE === 0) {
        continue;
      }

      // Create a signature for this index
      const signature = indexColumns
        .map(col => col.COLUMN_NAME)
        .sort()
        .join(',');

      if (seenIndexes.has(signature)) {
        console.log(`   🗑️  Removing duplicate index: ${indexName}`);
        try {
          await masterSequelize.query(`DROP INDEX \`${indexName}\` ON \`${tableName}\``);
          this.removedIndexes.push(`${tableName}.${indexName}`);
        } catch (error) {
          console.error(`   ❌ Error removing index ${indexName}:`, error.message);
          this.errors.push(`Remove ${indexName}: ${error.message}`);
        }
      } else {
        seenIndexes.add(signature);
      }
    }

    console.log(`   ✅ Index check completed for ${tableName}`);
  }

  async fixTenantsTable() {
    console.log('\n🔧 Fixing tenants table indexes...');
    
    try {
      // Remove any duplicate indexes
      await this.removeDuplicateIndexes('tenants');
      
      // Ensure we have the essential indexes only
      const essentialIndexes = [
        { name: 'idx_tenants_tenant_id', columns: ['tenant_id'], unique: true },
        { name: 'idx_tenants_seller_ntn_cnic', columns: ['seller_ntn_cnic'], unique: true },
        { name: 'idx_tenants_database_name', columns: ['database_name'], unique: false },
        { name: 'idx_tenants_is_active', columns: ['is_active'], unique: false }
      ];

      for (const index of essentialIndexes) {
        try {
          const unique = index.unique ? 'UNIQUE ' : '';
          const columns = index.columns.map(col => `\`${col}\``).join(', ');
          const sql = `CREATE ${unique}INDEX IF NOT EXISTS \`${index.name}\` ON \`tenants\` (${columns})`;
          
          await masterSequelize.query(sql);
          console.log(`   ✅ Ensured index: ${index.name}`);
        } catch (error) {
          if (!error.message.includes('Duplicate key name')) {
            console.error(`   ❌ Error creating index ${index.name}:`, error.message);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error fixing tenants table:', error.message);
      this.errors.push(`Fix tenants table: ${error.message}`);
    }
  }

  async fixUsersTable() {
    console.log('\n🔧 Fixing users table indexes...');
    
    try {
      await this.removeDuplicateIndexes('users');
      
      const essentialIndexes = [
        { name: 'idx_user_email', columns: ['email'], unique: true },
        { name: 'idx_user_role_id', columns: ['role_id'], unique: false },
        { name: 'idx_user_active', columns: ['is_active'], unique: false }
      ];

      for (const index of essentialIndexes) {
        try {
          const unique = index.unique ? 'UNIQUE ' : '';
          const columns = index.columns.map(col => `\`${col}\``).join(', ');
          const sql = `CREATE ${unique}INDEX IF NOT EXISTS \`${index.name}\` ON \`users\` (${columns})`;
          
          await masterSequelize.query(sql);
          console.log(`   ✅ Ensured index: ${index.name}`);
        } catch (error) {
          if (!error.message.includes('Duplicate key name')) {
            console.error(`   ❌ Error creating index ${index.name}:`, error.message);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error fixing users table:', error.message);
      this.errors.push(`Fix users table: ${error.message}`);
    }
  }

  async getTableList() {
    try {
      const [results] = await masterSequelize.query(
        `SELECT table_name 
         FROM information_schema.tables 
         WHERE table_schema = DATABASE() 
         AND table_type = 'BASE TABLE'`
      );
      return results.map(row => row.table_name);
    } catch (error) {
      console.error('Error getting table list:', error.message);
      return [];
    }
  }

  async run() {
    console.log('🔧 MySQL Index Fixer');
    console.log('='.repeat(40));
    
    const connected = await this.connect();
    if (!connected) {
      process.exit(1);
    }

    try {
      // Fix specific tables that commonly have index issues
      await this.fixTenantsTable();
      await this.fixUsersTable();
      
      // Get all tables and check for excessive indexes
      const tables = await this.getTableList();
      
      for (const table of tables) {
        const indexes = await this.getTableIndexes(table);
        if (indexes.length > 50) { // Warning if more than 50 indexes
          console.log(`⚠️  Table ${table} has ${indexes.length} indexes (consider cleanup)`);
        }
      }
      
      // Print summary
      console.log('\n' + '='.repeat(40));
      console.log('📊 INDEX FIX SUMMARY');
      console.log('='.repeat(40));
      
      if (this.removedIndexes.length > 0) {
        console.log(`✅ Removed duplicate indexes: ${this.removedIndexes.length}`);
        this.removedIndexes.forEach(index => console.log(`   - ${index}`));
      } else {
        console.log('✅ No duplicate indexes found');
      }
      
      if (this.errors.length > 0) {
        console.log(`\n❌ Errors encountered: ${this.errors.length}`);
        this.errors.forEach(error => console.log(`   - ${error}`));
      }
      
      console.log('\n🎉 Index fix completed!');
      
    } catch (error) {
      console.error('❌ Fatal error:', error.message);
      process.exit(1);
    } finally {
      await masterSequelize.close();
    }
  }
}

// Run the fixer
const fixer = new MySQLIndexFixer();
fixer.run().catch(console.error);
