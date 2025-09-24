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

async function checkUsers() {
  let connection;
  try {
    console.log('Connecting to database...');
    connection = await mysql.createConnection(connectionConfig);
    console.log('Connected to database');

    // Check users and their roles
    console.log('\n=== USERS AND ROLES ===');
    const [users] = await connection.execute(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.role_id, r.name as role_name, r.display_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.is_active = 1
      ORDER BY u.id
    `);
    
    console.table(users);

    // Check roles
    console.log('\n=== ROLES ===');
    const [roles] = await connection.execute(`
      SELECT id, name, display_name, description, is_system_role
      FROM roles
      ORDER BY id
    `);
    
    console.table(roles);

    // Check permissions
    console.log('\n=== PERMISSIONS ===');
    const [permissions] = await connection.execute(`
      SELECT id, name, display_name, category
      FROM permissions
      ORDER BY category, name
    `);
    
    console.table(permissions);

    // Check role permissions for a specific user
    if (users.length > 0) {
      const userId = users[0].id;
      console.log(`\n=== PERMISSIONS FOR USER ${userId} ===`);
      const [userPermissions] = await connection.execute(`
        SELECT p.name, p.display_name, p.category
        FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        JOIN roles r ON rp.role_id = r.id
        JOIN users u ON r.id = u.role_id
        WHERE u.id = ?
        ORDER BY p.category, p.name
      `, [userId]);
      
      console.table(userPermissions);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\nDatabase connection closed');
    }
  }
}

checkUsers();
