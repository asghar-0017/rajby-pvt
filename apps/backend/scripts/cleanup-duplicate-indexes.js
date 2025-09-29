#!/usr/bin/env node

/**
 * Cleanup Duplicate Indexes Script
 * 
 * This script removes duplicate indexes from MySQL tables that are causing
 * the "Too many keys specified; max 64 keys allowed" error.
 * 
 * The issue occurs when Sequelize runs schema synchronization multiple times,
 * creating duplicate indexes with names like tenant_id_2, tenant_id_3, etc.
 */

import { masterSequelize } from '../src/config/mysql.js';
import dotenv from 'dotenv';

dotenv.config();

class IndexCleanup {
  constructor() {
    this.tablesToClean = [
      'tenants',
      'users', 
      'roles',
      'permissions',
      'audit_permissions',
      'admin_users'
    ];
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✅';
    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  async getTableIndexes(tableName) {
    try {
      const [results] = await masterSequelize.query(`SHOW INDEX FROM \`${tableName}\``);
      return results;
    } catch (error) {
      this.log(`Error getting indexes for table ${tableName}: ${error.message}`, 'error');
      return [];
    }
  }

  async dropIndex(tableName, indexName) {
    try {
      await masterSequelize.query(`ALTER TABLE \`${tableName}\` DROP INDEX \`${indexName}\``);
      this.log(`Dropped index: ${tableName}.${indexName}`);
      return true;
    } catch (error) {
      this.log(`Error dropping index ${tableName}.${indexName}: ${error.message}`, 'warn');
      return false;
    }
  }

  async cleanupTableIndexes(tableName) {
    this.log(`Cleaning up indexes for table: ${tableName}`);
    
    const indexes = await this.getTableIndexes(tableName);
    if (indexes.length === 0) {
      this.log(`No indexes found for table ${tableName}`);
      return;
    }

    // Group indexes by column name
    const indexesByColumn = {};
    indexes.forEach(index => {
      const columnName = index.Column_name;
      if (!indexesByColumn[columnName]) {
        indexesByColumn[columnName] = [];
      }
      indexesByColumn[columnName].push(index);
    });

    let droppedCount = 0;

    // For each column, keep only the first index and drop duplicates
    for (const [columnName, columnIndexes] of Object.entries(indexesByColumn)) {
      if (columnIndexes.length <= 1) {
        continue; // No duplicates for this column
      }

      // Sort by index name to ensure consistent ordering
      columnIndexes.sort((a, b) => a.Key_name.localeCompare(b.Key_name));

      // Keep the first index (usually the original one without numbers)
      const keepIndex = columnIndexes[0];
      const duplicateIndexes = columnIndexes.slice(1);

      this.log(`Found ${duplicateIndexes.length} duplicate indexes for column ${columnName} in table ${tableName}`);

      // Drop duplicate indexes
      for (const duplicateIndex of duplicateIndexes) {
        // Skip PRIMARY key
        if (duplicateIndex.Key_name === 'PRIMARY') {
          continue;
        }

        const dropped = await this.dropIndex(tableName, duplicateIndex.Key_name);
        if (dropped) {
          droppedCount++;
        }
      }
    }

    this.log(`Cleaned up ${droppedCount} duplicate indexes from table ${tableName}`);
  }

  async checkTableExists(tableName) {
    try {
      const [results] = await masterSequelize.query(
        `SELECT COUNT(*) as count FROM information_schema.tables 
         WHERE table_schema = DATABASE() AND table_name = ?`,
        { replacements: [tableName] }
      );
      return results[0].count > 0;
    } catch (error) {
      return false;
    }
  }

  async run() {
    try {
      this.log('Starting duplicate index cleanup...');

      // Test database connection
      await masterSequelize.authenticate();
      this.log('Database connection established');

      let totalDropped = 0;

      for (const tableName of this.tablesToClean) {
        const tableExists = await this.checkTableExists(tableName);
        if (!tableExists) {
          this.log(`Table ${tableName} does not exist, skipping...`);
          continue;
        }

        const beforeCount = (await this.getTableIndexes(tableName)).length;
        await this.cleanupTableIndexes(tableName);
        const afterCount = (await this.getTableIndexes(tableName)).length;
        
        const dropped = beforeCount - afterCount;
        totalDropped += dropped;
        
        this.log(`Table ${tableName}: ${beforeCount} → ${afterCount} indexes (dropped ${dropped})`);
      }

      this.log(`Cleanup completed! Total indexes dropped: ${totalDropped}`);
      
      return {
        success: true,
        totalDropped
      };

    } catch (error) {
      this.log(`Cleanup failed: ${error.message}`, 'error');
      return {
        success: false,
        error: error.message
      };
    } finally {
      await masterSequelize.close();
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const cleanup = new IndexCleanup();
  cleanup.run()
    .then(result => {
      if (result.success) {
        console.log('\n✅ Index cleanup completed successfully!');
        process.exit(0);
      } else {
        console.log('\n❌ Index cleanup failed!');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export default IndexCleanup;