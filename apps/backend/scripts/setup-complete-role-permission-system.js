import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const connectionConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'Jsab43#%87dgDJ49bf^9b',
  database: process.env.MYSQL_MASTER_DB || 'fbr_integration',
  port: process.env.MYSQL_PORT || 3306
};

async function setupCompleteRolePermissionSystem() {
  let connection;
  try {
    console.log('🚀 Setting up complete role-permission system for production...');
    connection = await mysql.createConnection(connectionConfig);
    console.log('Connected to database');

    // Step 1: Create default roles if they don't exist
    console.log('\n📝 Step 1: Creating default roles...');
    
    const defaultRoles = [
      {
        name: 'admin',
        display_name: 'Administrator',
        description: 'Full system access with all permissions',
        is_system_role: 1
      },
      {
        name: 'buyer',
        display_name: 'Buyer Management',
        description: 'Buyer management and invoice creation permissions',
        is_system_role: 1
      },
      {
        name: 'user',
        display_name: 'Standard User',
        description: 'Basic user permissions for viewing and limited operations',
        is_system_role: 1
      }
    ];

    for (const role of defaultRoles) {
      try {
        // Check if role already exists
        const [existingRole] = await connection.execute(
          'SELECT id FROM roles WHERE name = ?',
          [role.name]
        );

        if (existingRole.length > 0) {
          console.log(`✓ Role '${role.name}' already exists (ID: ${existingRole[0].id})`);
        } else {
          // Create the role
          const [result] = await connection.execute(
            'INSERT INTO roles (name, display_name, description, is_system_role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
            [role.name, role.display_name, role.description, role.is_system_role, 1]
          );
          console.log(`✅ Created role '${role.name}' (ID: ${result.insertId})`);
        }
      } catch (error) {
        console.error(`❌ Error with role '${role.name}':`, error.message);
      }
    }

    // Step 2: Ensure all permissions exist with correct names
    console.log('\n📝 Step 2: Ensuring all permissions exist with correct names...');
    
    const requiredPermissions = [
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

    for (const permission of requiredPermissions) {
      try {
        // Check if permission exists
        const [existingPermission] = await connection.execute(
          'SELECT id FROM permissions WHERE name = ?',
          [permission.name]
        );

        if (existingPermission.length > 0) {
          // Update existing permission to ensure correct display_name and category
          await connection.execute(
            'UPDATE permissions SET display_name = ?, description = ?, category = ? WHERE name = ?',
            [permission.display_name, permission.description, permission.category, permission.name]
          );
          console.log(`✓ Updated permission '${permission.name}'`);
        } else {
          // Create new permission
          await connection.execute(
            'INSERT INTO permissions (name, display_name, description, category, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
            [permission.name, permission.display_name, permission.description, permission.category, 1]
          );
          console.log(`✅ Created permission '${permission.name}'`);
        }
      } catch (error) {
        console.error(`❌ Error with permission '${permission.name}':`, error.message);
      }
    }

    // Step 3: Set up role permissions
    console.log('\n📝 Step 3: Setting up role permissions...');
    
    // Get role IDs
    const [roles] = await connection.execute(`
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
      console.log(`\n🔧 Setting up permissions for ${role.name} role (ID: ${role.id})...`);
      
      // Clear existing permissions for this role
      await connection.execute(
        'DELETE FROM role_permissions WHERE role_id = ?',
        [role.id]
      );

      const rolePermissionNames = rolePermissions[role.name] || [];
      let addedCount = 0;

      for (const permissionName of rolePermissionNames) {
        try {
          // Find permission by name
          const [permission] = await connection.execute(
            'SELECT id FROM permissions WHERE name = ?',
            [permissionName]
          );
          
          if (permission.length > 0) {
            // Add permission to role
            await connection.execute(
              'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
              [role.id, permission[0].id]
            );
            console.log(`  ✓ Added ${permissionName}`);
            addedCount++;
          } else {
            console.log(`  ✗ Permission '${permissionName}' not found`);
          }
        } catch (error) {
          if (error.code !== 'ER_DUP_ENTRY') {
            console.error(`  ❌ Error adding ${permissionName}:`, error.message);
          }
        }
      }

      console.log(`  📊 Added ${addedCount} permissions to ${role.name} role`);
    }

    // Step 4: Show final summary
    console.log('\n📊 Final Role-Permission Summary:');
    
    for (const role of roles) {
      console.log(`\n=== ${role.name.toUpperCase()} ROLE (ID: ${role.id}) ===`);
      
      const [rolePermissionsList] = await connection.execute(`
        SELECT p.name, p.display_name, p.category
        FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        WHERE rp.role_id = ?
        ORDER BY p.category, p.name
      `, [role.id]);
      
      if (rolePermissionsList.length > 0) {
        console.table(rolePermissionsList);
      } else {
        console.log('No permissions assigned');
      }
    }

    // Step 5: Verify user assignments
    console.log('\n👤 User-Role Assignments:');
    const [users] = await connection.execute(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.role_id, r.name as role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.is_active = 1
    `);
    
    console.table(users);

    console.log('\n🎉 Complete role-permission system setup completed successfully!');
    console.log('\n📋 Summary:');
    console.log('✅ Default roles created/verified');
    console.log('✅ All permissions created/updated with correct names');
    console.log('✅ Role permissions assigned correctly');
    console.log('✅ System ready for production use');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

setupCompleteRolePermissionSystem();
