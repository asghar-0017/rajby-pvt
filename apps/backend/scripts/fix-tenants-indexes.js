#!/usr/bin/env node

/**
 * Fix Tenants Table Indexes
 * 
 * This script specifically fixes the "Too many keys" error on the tenants table
 * by removing duplicate and unnecessary indexes.
 */

import { masterSequelize } from '../src/config/mysql.js';
import dotenv from 'dotenv';

dotenv.config();

class TenantsIndexFixer {
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

  async getTenantsIndexes() {
    try {
      const [results] = await masterSequelize.query(
        `SELECT 
          INDEX_NAME,
          COLUMN_NAME,
          NON_UNIQUE,
          INDEX_TYPE,
          SEQ_IN_INDEX
        FROM information_schema.STATISTICS 
        WHERE table_schema = DATABASE() 
        AND table_name = 'tenants' 
        ORDER BY INDEX_NAME, SEQ_IN_INDEX`
      );
      return results;
    } catch (error) {
      console.error('Error getting tenants indexes:', error.message);
      return [];
    }
  }

  async removeAllNonEssentialIndexes() {
    console.log('🗑️  Removing all non-essential indexes from tenants table...');
    
    const indexes = await this.getTenantsIndexes();
    console.log(`Found ${indexes.length} indexes on tenants table`);
    
    // Keep only essential indexes
    const essentialIndexes = [
      'PRIMARY',
      'tenant_id',
      'seller_ntn_cnic',
      'database_name'
    ];
    
    // Group indexes by name
    const indexGroups = {};
    indexes.forEach(index => {
      if (!indexGroups[index.INDEX_NAME]) {
        indexGroups[index.INDEX_NAME] = [];
      }
      indexGroups[index.INDEX_NAME].push(index);
    });
    
    // Remove non-essential indexes
    for (const indexName of Object.keys(indexGroups)) {
      if (!essentialIndexes.includes(indexName)) {
        console.log(`   Removing index: ${indexName}`);
        try {
          await masterSequelize.query(`DROP INDEX \`${indexName}\` ON \`tenants\``);
          this.removedIndexes.push(indexName);
        } catch (error) {
          console.error(`   ❌ Error removing index ${indexName}:`, error.message);
          this.errors.push(`Remove ${indexName}: ${error.message}`);
        }
      }
    }
  }

  async createEssentialIndexes() {
    console.log('🔧 Creating essential indexes...');
    
    const essentialIndexes = [
      { name: 'idx_tenants_tenant_id', column: 'tenant_id', unique: true },
      { name: 'idx_tenants_seller_ntn_cnic', column: 'seller_ntn_cnic', unique: true },
      { name: 'idx_tenants_database_name', column: 'database_name', unique: false },
      { name: 'idx_tenants_is_active', column: 'is_active', unique: false }
    ];

    for (const index of essentialIndexes) {
      try {
        // Check if index already exists
        const [results] = await masterSequelize.query(
          `SELECT COUNT(*) as count FROM information_schema.STATISTICS 
           WHERE table_schema = DATABASE() 
           AND table_name = 'tenants' 
           AND index_name = ?`,
          { replacements: [index.name] }
        );
        
        if (results[0].count === 0) {
          const unique = index.unique ? 'UNIQUE ' : '';
          const sql = `CREATE ${unique}INDEX \`${index.name}\` ON \`tenants\` (\`${index.column}\`)`;
          
          await masterSequelize.query(sql);
          console.log(`   ✅ Created index: ${index.name}`);
        } else {
          console.log(`   ✅ Index already exists: ${index.name}`);
        }
      } catch (error) {
        console.error(`   ❌ Error creating index ${index.name}:`, error.message);
        this.errors.push(`Create ${index.name}: ${error.message}`);
      }
    }
  }

  async run() {
    console.log('🔧 Tenants Table Index Fixer');
    console.log('='.repeat(40));
    
    const connected = await this.connect();
    if (!connected) {
      process.exit(1);
    }

    try {
      // Remove all non-essential indexes
      await this.removeAllNonEssentialIndexes();
      
      // Create essential indexes
      await this.createEssentialIndexes();
      
      // Verify final state
      const finalIndexes = await this.getTenantsIndexes();
      console.log(`\n📊 Final state: ${finalIndexes.length} indexes on tenants table`);
      
      // Print summary
      console.log('\n' + '='.repeat(40));
      console.log('📊 TENANTS INDEX FIX SUMMARY');
      console.log('='.repeat(40));
      
      if (this.removedIndexes.length > 0) {
        console.log(`✅ Removed indexes: ${this.removedIndexes.length}`);
        this.removedIndexes.forEach(index => console.log(`   - ${index}`));
      }
      
      if (this.errors.length > 0) {
        console.log(`\n❌ Errors encountered: ${this.errors.length}`);
        this.errors.forEach(error => console.log(`   - ${error}`));
      }
      
      console.log('\n🎉 Tenants table index fix completed!');
      console.log('You can now restart your application and the auto schema sync should work.');
      
    } catch (error) {
      console.error('❌ Fatal error:', error.message);
      process.exit(1);
    } finally {
      await masterSequelize.close();
    }
  }
}

// Run the fixer
const fixer = new TenantsIndexFixer();
fixer.run().catch(console.error);
