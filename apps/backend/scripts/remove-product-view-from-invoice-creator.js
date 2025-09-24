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

async function removeProductViewFromInvoiceCreator() {
  let connection;
  try {
    console.log('Connecting to database...');
    connection = await mysql.createConnection(connectionConfig);
    console.log('Connected to database');

    // Get invoice_creator role ID
    const [invoiceCreatorRole] = await connection.execute(
      'SELECT id FROM roles WHERE name = ?',
      ['invoice_creator']
    );

    if (invoiceCreatorRole.length === 0) {
      console.log('invoice_creator role not found!');
      return;
    }

    const roleId = invoiceCreatorRole[0].id;
    console.log(`Invoice Creator role ID: ${roleId}`);

    // Remove ALL product-related permissions from invoice_creator role
    const productPermissions = [
      'product.view',
      'product.create',
      'product.edit',
      'product.delete',
      'product.upload',
      'product.bulk',
      'Read Product',
      'Create Product',
      'Update Product',
      'Delete Product'
    ];

    console.log('\nRemoving ALL product permissions from invoice_creator role...');

    for (const permissionName of productPermissions) {
      try {
        // Get permission ID
        const [permission] = await connection.execute(
          'SELECT id FROM permissions WHERE name = ?',
          [permissionName]
        );

        if (permission.length > 0) {
          const permissionId = permission[0].id;
          
          // Remove from role_permissions
          const [result] = await connection.execute(
            'DELETE FROM role_permissions WHERE role_id = ? AND permission_id = ?',
            [roleId, permissionId]
          );
          
          if (result.affectedRows > 0) {
            console.log(`✓ Removed ${permissionName} from invoice_creator role`);
          } else {
            console.log(`- ${permissionName} was not assigned to invoice_creator role`);
          }
        } else {
          console.log(`- Permission '${permissionName}' not found`);
        }
      } catch (error) {
        console.error(`Error removing ${permissionName}:`, error.message);
      }
    }

    // Show final invoice_creator role permissions
    console.log('\n=== FINAL INVOICE_CREATOR ROLE PERMISSIONS ===');
    const [finalPermissions] = await connection.execute(`
      SELECT p.name, p.display_name, p.category
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = ?
      ORDER BY p.category, p.name
    `, [roleId]);
    
    console.table(finalPermissions);

    console.log('\n✅ Invoice Creator role updated! Now invoice_creator users should only see:');
    console.log('- Dashboard');
    console.log('- Create Invoice');
    console.log('- Invoice List');
    console.log('\n❌ Hidden from invoice_creator users:');
    console.log('- Products (entire page)');
    console.log('- Reports');
    console.log('- Buyers');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

removeProductViewFromInvoiceCreator();
