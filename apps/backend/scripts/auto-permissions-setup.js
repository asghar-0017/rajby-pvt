#!/usr/bin/env node

/**
 * Auto Permissions Setup
 * 
 * This script automatically creates and manages permissions in the database.
 * It ensures all required permissions exist and are properly configured.
 */

import { masterSequelize } from '../src/config/mysql.js';
import dotenv from 'dotenv';

dotenv.config();

class AutoPermissionsSetup {
  constructor() {
    this.silent = process.env.SCHEMA_SYNC_SILENT === 'true';
    this.results = {
      permissionsCreated: 0,
      permissionsUpdated: 0,
      errors: []
    };
  }

  log(message, level = 'info') {
    if (!this.silent) {
      const timestamp = new Date().toISOString();
      const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✅';
      console.log(`[${timestamp}] ${prefix} ${message}`);
    }
  }

  /**
   * Get all required permissions
   */
  getRequiredPermissions() {
    return [
      // Dashboard
      { name: 'dashboard.view', display_name: 'View Dashboard', description: 'View dashboard and overview', category: 'Dashboard' },
      
      // Buyer Management
      { name: 'buyer.create', display_name: 'Create Buyer', description: 'Create new buyers', category: 'Buyer Management' },
      { name: 'buyer.view', display_name: 'Read Buyer', description: 'View buyer information', category: 'Buyer Management' },
      { name: 'buyer.update', display_name: 'Update Buyer', description: 'Update buyer information', category: 'Buyer Management' },
      { name: 'buyer.delete', display_name: 'Delete Buyer', description: 'Delete buyers', category: 'Buyer Management' },
      { name: 'buyer_uploader', display_name: 'Buyer Uploader', description: 'Upload buyers', category: 'Buyer Management' },
      
      // Invoice Management
      { name: 'invoice.create', display_name: 'Create Invoice', description: 'Create new invoices', category: 'Invoice Management' },
      { name: 'invoice.view', display_name: 'Read Invoice', description: 'View invoice information', category: 'Invoice Management' },
      { name: 'invoice.update', display_name: 'Update Invoice', description: 'Update invoice information', category: 'Invoice Management' },
      { name: 'invoice.delete', display_name: 'Delete Invoice', description: 'Delete invoices', category: 'Invoice Management' },
      { name: 'invoice_uploader', display_name: 'Invoice Uploader', description: 'Upload invoices', category: 'Invoice Management' },
      { name: 'invoice_validate', display_name: 'Invoice Validate', description: 'Validate invoices', category: 'Invoice Management' },
      { name: 'invoice_save', display_name: 'Invoice Save', description: 'Save invoices', category: 'Invoice Management' },
      
      // Product Management
      { name: 'product.create', display_name: 'Create Product', description: 'Create new products', category: 'Product Management' },
      { name: 'product.view', display_name: 'Read Product', description: 'View product information', category: 'Product Management' },
      { name: 'product.update', display_name: 'Update Product', description: 'Update product information', category: 'Product Management' },
      { name: 'product.delete', display_name: 'Delete Product', description: 'Delete products', category: 'Product Management' },
      { name: 'product_uploader', display_name: 'Product Uploader', description: 'Upload products', category: 'Product Management' },
      
      // Reports
      { name: 'report.view', display_name: 'Report View', description: 'View reports', category: 'Report Management' },
      
      // User Management
      { name: 'create_user', display_name: 'Create User', description: 'Create new users', category: 'User Management' },
      { name: 'read_user', display_name: 'Read User', description: 'View user information', category: 'User Management' },
      { name: 'update_user', display_name: 'Update User', description: 'Update user information', category: 'User Management' },
      { name: 'delete_user', display_name: 'Delete User', description: 'Delete users', category: 'User Management' },
      
      // Role Management
      { name: 'create_role', display_name: 'Create Role', description: 'Create new roles', category: 'Role Management' },
      { name: 'read_role', display_name: 'Read Role', description: 'View role information', category: 'Role Management' },
      { name: 'update_role', display_name: 'Update Role', description: 'Update role information', category: 'Role Management' },
      { name: 'delete_role', display_name: 'Delete Role', description: 'Delete roles', category: 'Role Management' },
      
      // Audit Management
      { name: 'audit.view', display_name: 'View Audit Logs', description: 'View audit logs and system activities', category: 'Audit Management' },
      { name: 'audit.export', display_name: 'Export Audit Data', description: 'Export audit data to CSV', category: 'Audit Management' },
      { name: 'audit.filter', display_name: 'Filter Audit Data', description: 'Filter and search audit data', category: 'Audit Management' },
      { name: 'audit.summary', display_name: 'View Audit Summary', description: 'View audit summary and statistics', category: 'Audit Management' }
    ];
  }


  /**
   * Setup permissions
   */
  async setupPermissions() {
    this.log('Setting up permissions...');
    
    const requiredPermissions = this.getRequiredPermissions();
    
    for (const permission of requiredPermissions) {
      try {
        // Check if permission exists
        const [existingPermission] = await masterSequelize.query(
          'SELECT id FROM permissions WHERE name = ?',
          { replacements: [permission.name] }
        );

        if (existingPermission.length > 0) {
          // Update existing permission to ensure correct display_name and category
          await masterSequelize.query(
            'UPDATE permissions SET display_name = ?, description = ?, category = ? WHERE name = ?',
            { replacements: [permission.display_name, permission.description, permission.category, permission.name] }
          );
          this.results.permissionsUpdated++;
          this.log(`Updated permission: ${permission.name}`);
        } else {
          // Create new permission
          await masterSequelize.query(
            'INSERT INTO permissions (name, display_name, description, category, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
            { replacements: [permission.name, permission.display_name, permission.description, permission.category, 1] }
          );
          this.results.permissionsCreated++;
          this.log(`Created permission: ${permission.name}`);
        }
      } catch (error) {
        this.log(`Error with permission '${permission.name}': ${error.message}`, 'error');
        this.results.errors.push(`Permission ${permission.name}: ${error.message}`);
      }
    }
  }


  /**
   * Setup role permissions
   */
  async setupRolePermissions() {
    this.log('Setting up role permissions...');
    
    // Get role IDs
    const [roles] = await masterSequelize.query(`
      SELECT id, name FROM roles WHERE name IN ('admin', 'buyer', 'user')
    `);

    // Define role permissions
    const rolePermissions = {
      admin: [
        // All permissions
        'create_user', 'read_user', 'update_user', 'delete_user',
        'create_role', 'read_role', 'update_role', 'delete_role',
        'invoice.create', 'invoice.view', 'invoice.update', 'invoice.delete',
        'invoice_uploader', 'invoice_validate', 'invoice_save',
        'buyer.create', 'buyer.view', 'buyer.update', 'buyer.delete', 'buyer_uploader',
        'product.create', 'product.view', 'product.update', 'product.delete', 'product_uploader',
        'dashboard.view', 'report.view',
        // Audit Management - Admin has full access
        'audit.view', 'audit.export', 'audit.filter', 'audit.summary'
      ],
      buyer: [
        // Dashboard access
        'dashboard.view',
        // Buyer management
        'buyer.create', 'buyer.view', 'buyer.update', 'buyer.delete', 'buyer_uploader',
        // Invoice permissions
        'invoice.create', 'invoice.view', 'invoice.update', 'invoice.delete',
        'invoice_uploader', 'invoice_validate', 'invoice_save',
        // Product read access
        'product.view',
        // Reports
        'report.view',
        // Audit Management - Buyer has view access
        'audit.view', 'audit.filter'
      ],
      user: [
        // Basic permissions
        'buyer.view', 'invoice.view', 'product.view',
        'dashboard.view', 'report.view'
        // Note: Regular users don't have audit access by default
      ]
    };

    for (const role of roles) {
      this.log(`Setting up permissions for ${role.name} role (ID: ${role.id})...`);
      
      // Clear existing permissions for this role
      await masterSequelize.query(
        'DELETE FROM role_permissions WHERE role_id = ?',
        { replacements: [role.id] }
      );

      const rolePermissionNames = rolePermissions[role.name] || [];
      let addedCount = 0;

      for (const permissionName of rolePermissionNames) {
        try {
          // Find permission by name
          const [permission] = await masterSequelize.query(
            'SELECT id FROM permissions WHERE name = ?',
            { replacements: [permissionName] }
          );
          
          if (permission.length > 0) {
            // Add permission to role
            await masterSequelize.query(
              'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
              { replacements: [role.id, permission[0].id] }
            );
            addedCount++;
          } else {
            this.log(`Permission '${permissionName}' not found`, 'warn');
          }
        } catch (error) {
          if (error.code !== 'ER_DUP_ENTRY') {
            this.log(`Error adding ${permissionName}: ${error.message}`, 'error');
          }
        }
      }

      this.log(`Added ${addedCount} permissions to ${role.name} role`);
    }
  }

  /**
   * Main execution method
   */
  async run() {
    const startTime = Date.now();
    
    try {
      this.log('Starting automatic permissions setup...');
      
      // Setup permissions
      await this.setupPermissions();
      
      // Setup role permissions (only for existing roles)
      await this.setupRolePermissions();
      
      const duration = Date.now() - startTime;
      this.log(`Permissions setup completed in ${duration}ms`);
      
      // Log summary
      if (!this.silent) {
        console.log(`\n📊 Permissions Setup Summary:`);
        console.log(`   Permissions created: ${this.results.permissionsCreated}`);
        console.log(`   Permissions updated: ${this.results.permissionsUpdated}`);
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
      this.log(`Permissions setup failed after ${duration}ms: ${error.message}`, 'error');
      
      return {
        success: false,
        duration,
        error: error.message,
        results: this.results
      };
    }
  }
}

// Export for use in other modules
export default AutoPermissionsSetup;

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const setup = new AutoPermissionsSetup();
  setup.run()
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
