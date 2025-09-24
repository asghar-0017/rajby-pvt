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

async function checkInvoiceCreatorPermissions() {
  let connection;
  try {
    console.log('Connecting to database...');
    connection = await mysql.createConnection(connectionConfig);
    console.log('Connected to database');

    // Check invoice_creator role permissions
    const [permissions] = await connection.execute(`
      SELECT p.name, p.display_name, p.category
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = (SELECT id FROM roles WHERE name = 'invoice_creator')
      ORDER BY p.category, p.name
    `);
    
    console.log('Invoice Creator permissions:');
    console.table(permissions);

    // Check if they have product.view permission
    const hasProductView = permissions.some(p => p.name === 'product.view');
    console.log(`\nHas product.view permission: ${hasProductView}`);
    
    if (hasProductView) {
      console.log('❌ ERROR: invoice_creator should NOT have product.view permission!');
      console.log('This is why they can see the Products page and SELECT button.');
    } else {
      console.log('✅ CORRECT: invoice_creator does not have product.view permission');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

checkInvoiceCreatorPermissions();
