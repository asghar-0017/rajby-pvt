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

async function assignUserRoles() {
  let connection;
  try {
    console.log('Connecting to database...');
    connection = await mysql.createConnection(connectionConfig);
    console.log('Connected to database');

    // Get role IDs
    const [roles] = await connection.execute(`
      SELECT id, name FROM roles ORDER BY id
    `);
    
    console.log('Available roles:');
    console.table(roles);

    // Assign roles to users
    const userRoleAssignments = [
      { email: 'asghar@gmail.com', roleName: 'admin' },
      { email: 'test@example.com', roleName: 'buyer' },
      { email: 'daniyal@gmail.com', roleName: 'user' },
      { email: 'q@gmail.com', roleName: 'user' },
      { email: 'x@gmail.com', roleName: 'user' },
      { email: 'h@gmail.com', roleName: 'user' },
      { email: 'jj@gmail.com', roleName: 'user' },
      { email: 'z@gmail.com', roleName: 'user' },
    ];

    console.log('\nAssigning roles to users...');
    
    for (const assignment of userRoleAssignments) {
      try {
        // Get role ID
        const role = roles.find(r => r.name === assignment.roleName);
        if (!role) {
          console.log(`Role '${assignment.roleName}' not found, skipping ${assignment.email}`);
          continue;
        }

        // Update user role
        const [result] = await connection.execute(
          'UPDATE users SET role_id = ? WHERE email = ?',
          [role.id, assignment.email]
        );

        if (result.affectedRows > 0) {
          console.log(`✓ Assigned role '${assignment.roleName}' to ${assignment.email}`);
        } else {
          console.log(`✗ User ${assignment.email} not found`);
        }
      } catch (error) {
        console.error(`Error assigning role to ${assignment.email}:`, error.message);
      }
    }

    // Verify assignments
    console.log('\n=== UPDATED USER ROLES ===');
    const [updatedUsers] = await connection.execute(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.role_id, r.name as role_name, r.display_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.is_active = 1
      ORDER BY u.id
    `);
    
    console.table(updatedUsers);

    console.log('\nRole assignment completed!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

assignUserRoles();
