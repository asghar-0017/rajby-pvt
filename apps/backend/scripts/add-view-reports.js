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

async function addViewReportsPermission() {
  let connection;
  try {
    console.log('Connecting to database...');
    connection = await mysql.createConnection(connectionConfig);
    console.log('Connected to database');

    // Check if View Reports permission exists
    const [existing] = await connection.execute(
      'SELECT id FROM permissions WHERE name = ?',
      ['View Reports']
    );

    if (existing.length === 0) {
      console.log('Adding View Reports permission...');
      await connection.execute(
        'INSERT INTO permissions (name, display_name, description, category) VALUES (?, ?, ?, ?)',
        ['View Reports', 'View Reports', 'View system reports and analytics', 'reports']
      );
      console.log('Added View Reports permission');
    } else {
      console.log('View Reports permission already exists');
    }

    // Add View Reports to user role
    console.log('Adding View Reports to user role...');
    
    // Get user role ID
    const [userRoleRows] = await connection.execute(
      'SELECT id FROM roles WHERE name = ?',
      ['user']
    );
    
    if (userRoleRows.length > 0) {
      const userRoleId = userRoleRows[0].id;
      
      // Get View Reports permission ID
      const [permissionRows] = await connection.execute(
        'SELECT id FROM permissions WHERE name = ?',
        ['View Reports']
      );
      
      if (permissionRows.length > 0) {
        const permissionId = permissionRows[0].id;
        
        // Add to role_permissions if not exists
        await connection.execute(
          'INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
          [userRoleId, permissionId]
        );
        console.log('Added View Reports to user role');
      }
    }

    console.log('View Reports permission setup completed!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

addViewReportsPermission();
