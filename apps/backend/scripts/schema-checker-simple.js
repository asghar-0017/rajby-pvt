#!/usr/bin/env node

/**
 * Simple Database Schema Checker and Auto-Creator
 * 
 * A simplified version that focuses on the most common missing schema issues.
 * This script checks for missing tables and columns and creates them automatically.
 * 
 * Usage:
 * node schema-checker-simple.js
 */

import { masterSequelize, createTenantConnection } from '../src/config/mysql.js';
import dotenv from 'dotenv';

// Import models
import Tenant from '../src/model/mysql/Tenant.js';
import User from '../src/model/mysql/User.js';
import Role from '../src/model/mysql/Role.js';
import Permission from '../src/model/mysql/Permission.js';
import RolePermission from '../src/model/mysql/RolePermission.js';
import AuditLog from '../src/model/mysql/AuditLog.js';
import AuditPermission from '../src/model/mysql/AuditPermission.js';

dotenv.config();

class SimpleSchemaChecker {
  constructor() {
    this.results = {
      tablesCreated: 0,
      columnsAdded: 0,
      errors: []
    };
  }

  /**
   * Check if table exists
   */
  async tableExists(sequelize, tableName) {
    try {
      const [results] = await sequelize.query(
        `SELECT COUNT(*) as count FROM information_schema.tables 
         WHERE table_schema = DATABASE() AND table_name = ?`,
        { replacements: [tableName] }
      );
      return results[0].count > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if column exists
   */
  async columnExists(sequelize, tableName, columnName) {
    try {
      const [results] = await sequelize.query(
        `SELECT COUNT(*) as count FROM information_schema.columns 
         WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
        { replacements: [tableName, columnName] }
      );
      return results[0].count > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create table using Sequelize sync
   */
  async createTable(sequelize, model) {
    try {
      await model.sync({ force: false, alter: true });
      console.log(`✅ Table synchronized: ${model.getTableName()}`);
      this.results.tablesCreated++;
      return true;
    } catch (error) {
      console.error(`❌ Error creating table ${model.getTableName()}:`, error.message);
      this.results.errors.push(`Table ${model.getTableName()}: ${error.message}`);
      return false;
    }
  }

  /**
   * Add missing column
   */
  async addMissingColumn(sequelize, tableName, columnName, columnType, allowNull = true, defaultValue = null) {
    try {
      let sql = `ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${columnType}`;
      
      if (!allowNull) {
        sql += ' NOT NULL';
      }
      
      if (defaultValue !== null) {
        if (typeof defaultValue === 'string') {
          sql += ` DEFAULT '${defaultValue}'`;
        } else {
          sql += ` DEFAULT ${defaultValue}`;
        }
      }
      
      await sequelize.query(sql);
      console.log(`✅ Added column: ${tableName}.${columnName}`);
      this.results.columnsAdded++;
      return true;
    } catch (error) {
      console.error(`❌ Error adding column ${tableName}.${columnName}:`, error.message);
      this.results.errors.push(`Column ${tableName}.${columnName}: ${error.message}`);
      return false;
    }
  }

  /**
   * Check and fix master database
   */
  async checkMasterDatabase() {
    console.log('\n🔍 Checking Master Database...\n');
    
    const models = [
      { name: 'Tenant', model: Tenant },
      { name: 'User', model: User },
      { name: 'Role', model: Role },
      { name: 'Permission', model: Permission },
      { name: 'RolePermission', model: RolePermission },
      { name: 'AuditLog', model: AuditLog },
      { name: 'AuditPermission', model: AuditPermission }
    ];

    for (const { name, model } of models) {
      const tableName = model.getTableName();
      
      try {
        // Use Sequelize sync to ensure table exists with correct structure
        await model.sync({ force: false, alter: true });
        console.log(`✅ Master table synchronized: ${tableName}`);
        this.results.tablesCreated++;
      } catch (error) {
        console.error(`❌ Error with master table ${tableName}:`, error.message);
        this.results.errors.push(`Master table ${tableName}: ${error.message}`);
      }
    }

    // Check for specific missing columns that are commonly missing
    await this.checkCommonMissingColumns(masterSequelize);
  }

  /**
   * Check for commonly missing columns
   */
  async checkCommonMissingColumns(sequelize) {
    const commonColumns = [
      { table: 'users', column: 'role_id', type: 'INT', allowNull: true },
      { table: 'invoices', column: 'internal_invoice_no', type: 'VARCHAR(100)', allowNull: true },
      { table: 'buyers', column: 'created_by_user_id', type: 'INT', allowNull: true },
      { table: 'buyers', column: 'created_by_email', type: 'VARCHAR(255)', allowNull: true },
      { table: 'buyers', column: 'created_by_name', type: 'VARCHAR(255)', allowNull: true },
      { table: 'products', column: 'created_by_user_id', type: 'INT', allowNull: true },
      { table: 'products', column: 'created_by_email', type: 'VARCHAR(255)', allowNull: true },
      { table: 'products', column: 'created_by_name', type: 'VARCHAR(255)', allowNull: true },
      { table: 'invoices', column: 'created_by_user_id', type: 'INT', allowNull: true },
      { table: 'invoices', column: 'created_by_email', type: 'VARCHAR(255)', allowNull: true },
      { table: 'invoices', column: 'created_by_name', type: 'VARCHAR(255)', allowNull: true }
    ];

    for (const { table, column, type, allowNull } of commonColumns) {
      const tableExists = await this.tableExists(sequelize, table);
      if (tableExists) {
        const columnExists = await this.columnExists(sequelize, table, column);
        if (!columnExists) {
          await this.addMissingColumn(sequelize, table, column, type, allowNull);
        }
      }
    }
  }

  /**
   * Check tenant databases
   */
  async checkTenantDatabases() {
    console.log('\n🔍 Checking Tenant Databases...\n');
    
    try {
      const tenants = await Tenant.findAll({
        where: { is_active: true },
        attributes: ['id', 'database_name', 'seller_business_name']
      });

      if (tenants.length === 0) {
        console.log('⚠️  No active tenants found');
        return;
      }

      for (const tenant of tenants) {
        console.log(`\n📋 Checking tenant: ${tenant.seller_business_name}`);
        
        try {
          const tenantSequelize = createTenantConnection(tenant.database_name);
          await tenantSequelize.authenticate();
          
          // Check common missing columns in tenant databases
          await this.checkCommonMissingColumns(tenantSequelize);
          
          await tenantSequelize.close();
        } catch (error) {
          console.error(`❌ Error checking tenant ${tenant.database_name}:`, error.message);
          this.results.errors.push(`Tenant ${tenant.database_name}: ${error.message}`);
        }
      }
    } catch (error) {
      console.error('❌ Error getting tenants:', error.message);
      this.results.errors.push(`Get tenants: ${error.message}`);
    }
  }

  /**
   * Print results summary
   */
  printSummary() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 SCHEMA CHECK RESULTS');
    console.log('='.repeat(50));
    
    console.log(`✅ Tables synchronized: ${this.results.tablesCreated}`);
    console.log(`✅ Columns added: ${this.results.columnsAdded}`);
    
    if (this.results.errors.length > 0) {
      console.log(`\n❌ Errors encountered: ${this.results.errors.length}`);
      this.results.errors.forEach(error => console.log(`   - ${error}`));
    } else {
      console.log('\n🎉 No errors encountered!');
    }
    
    console.log('\n' + '='.repeat(50));
  }

  /**
   * Main execution
   */
  async run() {
    console.log('🚀 Simple Database Schema Checker');
    console.log('='.repeat(40));
    
    try {
      await masterSequelize.authenticate();
      console.log('✅ Connected to master database');
      
      await this.checkMasterDatabase();
      await this.checkTenantDatabases();
      
      this.printSummary();
      
    } catch (error) {
      console.error('❌ Database connection error:', error.message);
      process.exit(1);
    } finally {
      await masterSequelize.close();
    }
  }
}

// Run the checker
const checker = new SimpleSchemaChecker();
checker.run().catch(console.error);
