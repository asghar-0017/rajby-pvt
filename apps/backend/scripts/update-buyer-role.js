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

async function updateBuyerRole() {
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

    // Get permissions that buyer should have
    const buyerPermissions = [
      'View Dashboard',
      'Read Buyer', 
      'Create Buyer',
      'Update Buyer',
      'Read Invoice',
      'Create Invoice',
      'Read Product',
      'View Reports'
    ];

    console.log('\nAdding permissions to buyer role...');

    for (const permissionName of buyerPermissions) {
      try {
        // Get permission ID
        const [permission] = await connection.execute(
          'SELECT id FROM permissions WHERE name = ?',
          [permissionName]
        );

        if (permission.length > 0) {
          const permissionId = permission[0].id;
          
          // Add to role_permissions if not exists
          await connection.execute(
            'INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
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

    // Show buyer role permissions
    console.log('\n=== BUYER ROLE PERMISSIONS ===');
    const [buyerPermissionsList] = await connection.execute(`
      SELECT p.name, p.display_name, p.category
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = ?
      ORDER BY p.category, p.name
    `, [buyerRoleId]);
    
    console.table(buyerPermissionsList);

    console.log('\nBuyer role update completed!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

updateBuyerRole();
