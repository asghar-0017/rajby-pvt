#!/usr/bin/env node

/**
 * Test Database Schema Checker
 * 
 * This script tests the schema checker functionality without requiring
 * a database connection. It validates the model definitions and shows
 * what would be checked/created.
 */

import dotenv from 'dotenv';

// Import models
import Tenant from '../src/model/mysql/Tenant.js';
import User from '../src/model/mysql/User.js';
import Role from '../src/model/mysql/Role.js';
import Permission from '../src/model/mysql/Permission.js';
import RolePermission from '../src/model/mysql/RolePermission.js';
import AuditLog from '../src/model/mysql/AuditLog.js';
import AuditPermission from '../src/model/mysql/AuditPermission.js';

// Import tenant models
import { createBuyerModel } from '../src/model/mysql/tenant/Buyer.js';
import { createProductModel } from '../src/model/mysql/tenant/Product.js';
import { createInvoiceModel } from '../src/model/mysql/tenant/Invoice.js';
import { createInvoiceItemModel } from '../src/model/mysql/tenant/InvoiceItem.js';

dotenv.config();

class TestSchemaChecker {
  constructor() {
    this.masterModels = {
      tenants: Tenant,
      users: User,
      roles: Role,
      permissions: Permission,
      role_permissions: RolePermission,
      audit_logs: AuditLog,
      audit_permissions: AuditPermission
    };
    
    this.tenantModels = {
      buyers: createBuyerModel,
      products: createProductModel,
      invoices: createInvoiceModel,
      invoice_items: createInvoiceItemModel
    };
  }

  /**
   * Convert Sequelize DataType to MySQL column definition
   */
  getMySQLColumnDefinition(attribute) {
    const { type, allowNull, defaultValue, field, unique, primaryKey, autoIncrement, comment } = attribute;
    
    let columnDef = '';
    
    // Handle different Sequelize data types
    if (type.constructor.name === 'STRING') {
      const length = type.options?.length || 255;
      columnDef = `VARCHAR(${length})`;
    } else if (type.constructor.name === 'TEXT') {
      columnDef = 'TEXT';
    } else if (type.constructor.name === 'INTEGER') {
      columnDef = 'INT';
    } else if (type.constructor.name === 'BOOLEAN') {
      columnDef = 'BOOLEAN';
    } else if (type.constructor.name === 'DATE') {
      columnDef = 'DATETIME';
    } else if (type.constructor.name === 'DECIMAL') {
      const precision = type.options?.precision || 10;
      const scale = type.options?.scale || 2;
      columnDef = `DECIMAL(${precision}, ${scale})`;
    } else if (type.constructor.name === 'JSON') {
      columnDef = 'JSON';
    } else if (type.constructor.name === 'ENUM') {
      const values = type.options?.values || [];
      columnDef = `ENUM('${values.join("', '")}')`;
    } else {
      columnDef = 'TEXT'; // fallback
    }
    
    // Add constraints
    if (primaryKey) {
      columnDef += ' PRIMARY KEY';
    }
    if (autoIncrement) {
      columnDef += ' AUTO_INCREMENT';
    }
    if (!allowNull && !primaryKey) {
      columnDef += ' NOT NULL';
    }
    if (unique && !primaryKey) {
      columnDef += ' UNIQUE';
    }
    if (defaultValue !== undefined) {
      if (typeof defaultValue === 'string') {
        columnDef += ` DEFAULT '${defaultValue}'`;
      } else if (typeof defaultValue === 'boolean') {
        columnDef += ` DEFAULT ${defaultValue ? 1 : 0}`;
      } else {
        columnDef += ` DEFAULT ${defaultValue}`;
      }
    }
    if (comment) {
      columnDef += ` COMMENT '${comment}'`;
    }
    
    return columnDef;
  }

  /**
   * Analyze a model and show its structure
   */
  analyzeModel(modelName, model) {
    const tableName = model.getTableName();
    const attributes = model.rawAttributes;
    const options = model.options;
    
    console.log(`\n📋 Model: ${modelName}`);
    console.log(`   Table: ${tableName}`);
    console.log(`   Timestamps: ${options.timestamps ? 'Yes' : 'No'}`);
    
    if (Object.keys(attributes).length > 0) {
      console.log(`   Columns:`);
      for (const [fieldName, attribute] of Object.entries(attributes)) {
        const columnName = attribute.field || fieldName;
        const columnDef = this.getMySQLColumnDefinition(attribute);
        console.log(`     - ${columnName}: ${columnDef}`);
      }
    }
    
    if (options.indexes && options.indexes.length > 0) {
      console.log(`   Indexes:`);
      for (const index of options.indexes) {
        const indexName = index.name || `idx_${tableName}_${index.fields.join('_')}`;
        const unique = index.unique ? 'UNIQUE ' : '';
        console.log(`     - ${unique}${indexName} (${index.fields.join(', ')})`);
      }
    }
  }

  /**
   * Test master database models
   */
  testMasterModels() {
    console.log('🔍 MASTER DATABASE MODELS');
    console.log('='.repeat(50));
    
    for (const [modelName, model] of Object.entries(this.masterModels)) {
      this.analyzeModel(modelName, model);
    }
  }

  /**
   * Test tenant database models
   */
  testTenantModels() {
    console.log('\n🔍 TENANT DATABASE MODELS');
    console.log('='.repeat(50));
    
    // Create a mock sequelize instance for testing
    const mockSequelize = {
      define: (name, attributes, options) => ({
        getTableName: () => options?.tableName || name.toLowerCase(),
        rawAttributes: attributes,
        options: options || {}
      })
    };
    
    for (const [modelName, modelFactory] of Object.entries(this.tenantModels)) {
      try {
        const model = modelFactory(mockSequelize);
        this.analyzeModel(modelName, model);
      } catch (error) {
        console.log(`\n📋 Model: ${modelName}`);
        console.log(`   Error: ${error.message}`);
      }
    }
  }

  /**
   * Show common missing columns that would be checked
   */
  showCommonMissingColumns() {
    console.log('\n🔍 COMMON MISSING COLUMNS CHECK');
    console.log('='.repeat(50));
    
    const commonColumns = [
      { table: 'users', column: 'role_id', type: 'INT', allowNull: true, description: 'Foreign key to roles table' },
      { table: 'invoices', column: 'internal_invoice_no', type: 'VARCHAR(100)', allowNull: true, description: 'Internal invoice reference number' },
      { table: 'buyers', column: 'created_by_user_id', type: 'INT', allowNull: true, description: 'User who created the buyer' },
      { table: 'buyers', column: 'created_by_email', type: 'VARCHAR(255)', allowNull: true, description: 'Email of creator' },
      { table: 'buyers', column: 'created_by_name', type: 'VARCHAR(255)', allowNull: true, description: 'Name of creator' },
      { table: 'products', column: 'created_by_user_id', type: 'INT', allowNull: true, description: 'User who created the product' },
      { table: 'products', column: 'created_by_email', type: 'VARCHAR(255)', allowNull: true, description: 'Email of creator' },
      { table: 'products', column: 'created_by_name', type: 'VARCHAR(255)', allowNull: true, description: 'Name of creator' },
      { table: 'invoices', column: 'created_by_user_id', type: 'INT', allowNull: true, description: 'User who created the invoice' },
      { table: 'invoices', column: 'created_by_email', type: 'VARCHAR(255)', allowNull: true, description: 'Email of creator' },
      { table: 'invoices', column: 'created_by_name', type: 'VARCHAR(255)', allowNull: true, description: 'Name of creator' }
    ];

    for (const { table, column, type, allowNull, description } of commonColumns) {
      const nullable = allowNull ? 'NULL' : 'NOT NULL';
      console.log(`   ${table}.${column}: ${type} ${nullable} - ${description}`);
    }
  }

  /**
   * Show what the script would do
   */
  showScriptActions() {
    console.log('\n🔍 SCRIPT ACTIONS');
    console.log('='.repeat(50));
    
    console.log('The schema checker would:');
    console.log('1. Connect to master database');
    console.log('2. Check if master tables exist and create if missing');
    console.log('3. Check master table columns and add if missing');
    console.log('4. Check master table indexes and create if missing');
    console.log('5. Get list of active tenants');
    console.log('6. For each tenant database:');
    console.log('   - Connect to tenant database');
    console.log('   - Check tenant tables and create if missing');
    console.log('   - Check tenant columns and add if missing');
    console.log('   - Check tenant indexes and create if missing');
    console.log('7. Report summary of all changes made');
  }

  /**
   * Show environment configuration
   */
  showEnvironmentConfig() {
    console.log('\n🔍 ENVIRONMENT CONFIGURATION');
    console.log('='.repeat(50));
    
    const envVars = [
      'MYSQL_HOST',
      'MYSQL_PORT', 
      'MYSQL_USER',
      'MYSQL_PASSWORD',
      'MYSQL_MASTER_DB'
    ];
    
    for (const envVar of envVars) {
      const value = process.env[envVar];
      if (value) {
        // Mask password
        const displayValue = envVar === 'MYSQL_PASSWORD' ? '***' : value;
        console.log(`   ${envVar}: ${displayValue}`);
      } else {
        console.log(`   ${envVar}: ❌ NOT SET`);
      }
    }
  }

  /**
   * Run the test
   */
  run() {
    console.log('🧪 DATABASE SCHEMA CHECKER TEST');
    console.log('='.repeat(50));
    console.log('This test shows what the schema checker would do without connecting to the database.\n');
    
    this.showEnvironmentConfig();
    this.testMasterModels();
    this.testTenantModels();
    this.showCommonMissingColumns();
    this.showScriptActions();
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ Test completed successfully!');
    console.log('To run the actual schema checker, ensure your database is configured and run:');
    console.log('   node scripts/schema-checker-simple.js');
    console.log('='.repeat(50));
  }
}

// Run the test
const tester = new TestSchemaChecker();
tester.run();
