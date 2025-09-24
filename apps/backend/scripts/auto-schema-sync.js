#!/usr/bin/env node

/**
 * Auto Schema Synchronization
 * 
 * This script automatically runs schema checks and updates during application startup.
 * It's designed to run silently in the background without user interaction.
 * 
 * Features:
 * - Runs automatically on application startup
 * - Silent operation with minimal logging
 * - Error handling that doesn't crash the application
 * - Can be integrated into Docker containers or deployment scripts
 * - Configurable via environment variables
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
import UserTenantAssignment from '../src/model/mysql/UserTenantAssignment.js';
import AutoPermissionsSetup from './auto-permissions-setup.js';

dotenv.config();

class AutoSchemaSync {
  constructor() {
    this.silent = process.env.SCHEMA_SYNC_SILENT === 'true';
    this.maxRetries = parseInt(process.env.SCHEMA_SYNC_MAX_RETRIES) || 3;
    this.retryDelay = parseInt(process.env.SCHEMA_SYNC_RETRY_DELAY) || 5000;
    this.results = {
      tablesCreated: 0,
      columnsAdded: 0,
      permissionsCreated: 0,
      permissionsUpdated: 0,
      errors: [],
      warnings: []
    };
  }

  log(message, level = 'info') {
    if (!this.silent) {
      const timestamp = new Date().toISOString();
      const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✅';
      console.log(`[${timestamp}] ${prefix} ${message}`);
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async retryOperation(operation, operationName, retries = this.maxRetries) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === retries) {
          this.log(`Failed ${operationName} after ${retries} attempts: ${error.message}`, 'error');
          this.results.errors.push(`${operationName}: ${error.message}`);
          throw error;
        } else {
          this.log(`Attempt ${attempt} failed for ${operationName}, retrying in ${this.retryDelay}ms...`, 'warn');
          await this.sleep(this.retryDelay);
        }
      }
    }
  }

  async checkDatabaseConnection() {
    try {
      await masterSequelize.authenticate();
      this.log('Database connection established');
      return true;
    } catch (error) {
      this.log(`Database connection failed: ${error.message}`, 'error');
      return false;
    }
  }

  async syncMasterDatabase() {
    this.log('Synchronizing master database schema...');
    
    const models = [
      { name: 'Tenant', model: Tenant },
      { name: 'User', model: User },
      { name: 'Role', model: Role },
      { name: 'Permission', model: Permission },
      { name: 'RolePermission', model: RolePermission },
      { name: 'AuditLog', model: AuditLog },
      { name: 'AuditPermission', model: AuditPermission },
      { name: 'UserTenantAssignment', model: UserTenantAssignment }
    ];

    for (const { name, model } of models) {
      try {
        await this.retryOperation(
          () => model.sync({ force: false, alter: true }),
          `Sync master table ${name}`
        );
        this.results.tablesCreated++;
        this.log(`Master table synchronized: ${model.getTableName()}`);
      } catch (error) {
        this.log(`Failed to sync master table ${name}: ${error.message}`, 'error');
      }
    }

    // Check for common missing columns
    await this.checkCommonMissingColumns(masterSequelize, 'master');
  }

  async checkCommonMissingColumns(sequelize, databaseType) {
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
      try {
        const tableExists = await this.tableExists(sequelize, table);
        if (tableExists) {
          const columnExists = await this.columnExists(sequelize, table, column);
          if (!columnExists) {
            await this.addMissingColumn(sequelize, table, column, type, allowNull);
            this.results.columnsAdded++;
            this.log(`Added column: ${table}.${column} (${databaseType})`);
          }
        }
      } catch (error) {
        // Ignore duplicate column errors
        if (!error.message.includes('Duplicate column name')) {
          this.log(`Error checking column ${table}.${column}: ${error.message}`, 'warn');
        }
      }
    }
  }

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

  async addMissingColumn(sequelize, tableName, columnName, columnType, allowNull = true, defaultValue = null) {
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
  }

  async syncTenantDatabases() {
    try {
      const tenants = await Tenant.findAll({
        where: { is_active: true },
        attributes: ['id', 'database_name', 'seller_business_name']
      });

      if (tenants.length === 0) {
        this.log('No active tenants found');
        return;
      }

      this.log(`Found ${tenants.length} active tenants`);

      for (const tenant of tenants) {
        try {
          const tenantSequelize = createTenantConnection(tenant.database_name);
          await this.retryOperation(
            () => tenantSequelize.authenticate(),
            `Connect to tenant ${tenant.database_name}`
          );
          
          await this.checkCommonMissingColumns(tenantSequelize, `tenant: ${tenant.seller_business_name}`);
          
          await tenantSequelize.close();
        } catch (error) {
          this.log(`Failed to sync tenant ${tenant.database_name}: ${error.message}`, 'warn');
          this.results.warnings.push(`Tenant ${tenant.database_name}: ${error.message}`);
        }
      }
    } catch (error) {
      this.log(`Error getting tenants: ${error.message}`, 'warn');
      this.results.warnings.push(`Get tenants: ${error.message}`);
    }
  }

  /**
   * Setup permissions and roles
   */
  async setupPermissionsAndRoles() {
    try {
      this.log('Setting up permissions and roles...');
      
      const permissionsSetup = new AutoPermissionsSetup();
      permissionsSetup.silent = this.silent;
      
      const result = await permissionsSetup.run();
      
      if (result.success) {
        this.results.permissionsCreated += result.results.permissionsCreated;
        this.results.permissionsUpdated += result.results.permissionsUpdated;
        this.results.errors.push(...result.results.errors);
        this.log('Permissions and roles setup completed successfully');
      } else {
        this.log(`Permissions setup failed: ${result.error}`, 'error');
        this.results.errors.push(`Permissions setup: ${result.error}`);
      }
    } catch (error) {
      this.log(`Error setting up permissions: ${error.message}`, 'error');
      this.results.errors.push(`Permissions setup: ${error.message}`);
    }
  }

  async run(options = {}) {
    const { keepConnectionOpen = false } = options;
    const startTime = Date.now();
    
    try {
      this.log('Starting automatic schema synchronization...');
      
      // Check database connection
      const connected = await this.checkDatabaseConnection();
      if (!connected) {
        throw new Error('Cannot connect to database');
      }

      // Sync master database
      await this.syncMasterDatabase();

      // Sync tenant databases
      await this.syncTenantDatabases();

      // Setup permissions and roles
      await this.setupPermissionsAndRoles();

      const duration = Date.now() - startTime;
      this.log(`Schema synchronization completed in ${duration}ms`);
      
      // Log summary
      if (!this.silent) {
        console.log(`\n📊 Schema Sync Summary:`);
        console.log(`   Tables synchronized: ${this.results.tablesCreated}`);
        console.log(`   Columns added: ${this.results.columnsAdded}`);
        console.log(`   Permissions created: ${this.results.permissionsCreated}`);
        console.log(`   Permissions updated: ${this.results.permissionsUpdated}`);
        if (this.results.warnings.length > 0) {
          console.log(`   Warnings: ${this.results.warnings.length}`);
        }
        if (this.results.errors.length > 0) {
          console.log(`   Errors: ${this.results.errors.length}`);
        }
      }

      return {
        success: true,
        duration,
        results: this.results
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.log(`Schema synchronization failed after ${duration}ms: ${error.message}`, 'error');
      
      return {
        success: false,
        duration,
        error: error.message,
        results: this.results
      };
    } finally {
      // Only close connection if not keeping it open for the application
      if (!keepConnectionOpen) {
        try {
          await masterSequelize.close();
        } catch (error) {
          // Ignore connection close errors
        }
      }
    }
  }
}

// Export for use in other modules
export default AutoSchemaSync;

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const sync = new AutoSchemaSync();
  sync.run()
    .then(result => {
      if (result.success) {
        process.exit(0);
      } else {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
