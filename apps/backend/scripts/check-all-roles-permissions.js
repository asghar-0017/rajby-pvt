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

async function checkAllRolesPermissions() {
  let connection;
  try {
    console.log('Connecting to database...');
    connection = await mysql.createConnection(connectionConfig);
    console.log('Connected to database');

    // Get all roles
    const [roles] = await connection.execute(`
      SELECT id, name, display_name, description FROM roles ORDER BY id
    `);
    
    console.log('All roles:');
    console.table(roles);

    // Check permissions for each role
    for (const role of roles) {
      console.log(`\n=== ${role.name.toUpperCase()} ROLE (ID: ${role.id}) ===`);
      
      const [permissions] = await connection.execute(`
        SELECT p.name, p.display_name, p.category
        FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        WHERE rp.role_id = ?
        ORDER BY p.category, p.name
      `, [role.id]);
      
      if (permissions.length > 0) {
        console.table(permissions);
        
        // Check for the specific product permissions you want to remove
        const productPermissions = permissions.filter(p => 
          p.name === 'product.create' || 
          p.name === 'product.delete' || 
          p.name === 'product.bulk'
        );
        
        if (productPermissions.length > 0) {
          console.log('⚠️  This role has product permissions that might need to be removed:');
          productPermissions.forEach(p => console.log(`- ${p.name} (${p.display_name})`));
        }
      } else {
        console.log('No permissions assigned');
      }
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

checkAllRolesPermissions();
