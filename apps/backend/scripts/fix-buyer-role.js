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

async function fixBuyerRole() {
  let connection;
  try {
    console.log('Connecting to database...');
    connection = await mysql.createConnection(connectionConfig);
    console.log('Connected to database');

    // Get buyer role ID
    const [buyerRole] = await connection.execute(
      'SELECT id FROM roles WHERE name = ?',
      ['buyer']
    );

    if (buyerRole.length === 0) {
      console.log('Buyer role not found!');
      return;
    }

    const buyerRoleId = buyerRole[0].id;
    console.log(`Buyer role ID: ${buyerRoleId}`);

    // Clear all existing permissions for buyer role
    console.log('Clearing existing buyer role permissions...');
    await connection.execute(
      'DELETE FROM role_permissions WHERE role_id = ?',
      [buyerRoleId]
    );

    // Define buyer-specific permissions only
    const buyerPermissions = [
      'View Dashboard',      // Dashboard access
      'buyer.view',         // View buyers
      'buyer.create',       // Create buyers
      'buyer.edit',         // Edit buyers
      'buyer.delete',       // Delete buyers
      'invoice.view',       // View invoices
      'invoice.create',     // Create invoices
    ];

    console.log('\nAdding buyer-specific permissions only...');

    for (const permissionName of buyerPermissions) {
      try {
        // Get permission ID
        const [permission] = await connection.execute(
          'SELECT id FROM permissions WHERE name = ?',
          [permissionName]
        );

        if (permission.length > 0) {
          const permissionId = permission[0].id;
          
          // Add to role_permissions
          await connection.execute(
            'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
            [buyerRoleId, permissionId]
          );
          console.log(`✓ Added ${permissionName} to buyer role`);
        } else {
          console.log(`✗ Permission '${permissionName}' not found`);
        }
      } catch (error) {
        console.error(`Error adding ${permissionName}:`, error.message);
      }
    }

    // Show updated buyer role permissions
    console.log('\n=== UPDATED BUYER ROLE PERMISSIONS ===');
    const [buyerPermissionsList] = await connection.execute(`
      SELECT p.name, p.display_name, p.category
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = ?
      ORDER BY p.category, p.name
    `, [buyerRoleId]);
    
    console.table(buyerPermissionsList);

    console.log('\nBuyer role fixed! Now buyer users should only see:');
    console.log('- Dashboard');
    console.log('- Buyers (view, create, edit, delete)');
    console.log('- Invoice List (view)');
    console.log('- Create Invoice');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

fixBuyerRole();
