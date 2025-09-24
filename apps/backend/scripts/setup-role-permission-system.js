import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { masterSequelize } from '../src/config/mysql.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function setupRolePermissionSystem() {
  try {
    console.log('🚀 Starting Role and Permission System Setup...');
    
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, 'setup-role-permission-system.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => {
        // Keep statements that are not empty
        if (stmt.length === 0) return false;
        
        // Remove lines that are only comments, but keep statements that have SQL code
        const lines = stmt.split('\n');
        const nonCommentLines = lines.filter(line => {
          const trimmed = line.trim();
          return trimmed.length > 0 && !trimmed.startsWith('--');
        });
        
        // Keep the statement if it has non-comment lines
        return nonCommentLines.length > 0;
      })
      .map(stmt => {
        // Clean up the statement by removing comment lines
        const lines = stmt.split('\n');
        const cleanedLines = lines.filter(line => {
          const trimmed = line.trim();
          return trimmed.length > 0 && !trimmed.startsWith('--');
        });
        return cleanedLines.join('\n').trim();
      });
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
          await masterSequelize.query(statement, { type: masterSequelize.QueryTypes.RAW });
        } catch (error) {
          // Some statements might fail if they already exist, which is fine
          if (error.message.includes('already exists') || 
              error.message.includes('Duplicate entry') ||
              error.message.includes('Duplicate key')) {
            console.log(`⚠️  Statement ${i + 1} skipped (already exists): ${error.message.split('\n')[0]}`);
          } else {
            console.error(`❌ Error executing statement ${i + 1}:`, error.message);
            throw error;
          }
        }
      }
    }
    
    // Create additional indexes for better performance
    console.log('🔧 Creating performance indexes...');
    const indexStatements = [
      'CREATE INDEX `idx_users_email_active` ON `users` (`email`, `is_active`)',
      'CREATE INDEX `idx_users_role_active` ON `users` (`role_id`, `is_active`)',
      'CREATE INDEX `idx_role_permissions_lookup` ON `role_permissions` (`role_id`, `permission_id`)'
    ];
    
    for (const indexStatement of indexStatements) {
      try {
        await masterSequelize.query(indexStatement, { type: masterSequelize.QueryTypes.RAW });
        console.log(`✅ Created index: ${indexStatement.split('`')[1]}`);
      } catch (error) {
        if (error.message.includes('already exists') || error.message.includes('Duplicate key')) {
          console.log(`⚠️  Index already exists: ${indexStatement.split('`')[1]}`);
        } else {
          console.log(`⚠️  Could not create index: ${error.message.split('\n')[0]}`);
        }
      }
    }
    
    console.log('✅ Role and Permission System setup completed successfully!');
    
    // Verify the setup
    const [roles] = await masterSequelize.query('SELECT COUNT(*) as count FROM roles', { type: masterSequelize.QueryTypes.SELECT });
    const [permissions] = await masterSequelize.query('SELECT COUNT(*) as count FROM permissions', { type: masterSequelize.QueryTypes.SELECT });
    const [rolePermissions] = await masterSequelize.query('SELECT COUNT(*) as count FROM role_permissions', { type: masterSequelize.QueryTypes.SELECT });
    
    // Check if role_id column exists before querying users
    let usersWithRoles = { count: 0 };
    try {
      const [result] = await masterSequelize.query('SELECT COUNT(*) as count FROM users WHERE role_id IS NOT NULL', { type: masterSequelize.QueryTypes.SELECT });
      usersWithRoles = result;
    } catch (error) {
      console.log('⚠️  role_id column not found in users table - this is expected if the column addition failed');
    }
    
    console.log('\n📊 Setup Summary:');
    console.log(`   - Roles created: ${roles.count}`);
    console.log(`   - Permissions created: ${permissions.count}`);
    console.log(`   - Role-Permission assignments: ${rolePermissions.count}`);
    console.log(`   - Users with roles: ${usersWithRoles.count}`);
    
    // Display roles and their permissions
    console.log('\n🔐 Role-Permission Assignments:');
    const rolePermissionsData = await masterSequelize.query(`
      SELECT 
        r.name as role_name,
        r.description as role_description,
        r.is_system_role,
        COUNT(rp.permission_id) as permission_count
      FROM roles r
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      GROUP BY r.id, r.name, r.description, r.is_system_role
      ORDER BY r.is_system_role DESC, r.name
    `, { type: masterSequelize.QueryTypes.SELECT });
    
    rolePermissionsData.forEach(role => {
      const systemFlag = role.is_system_role ? ' (System)' : '';
      console.log(`   - ${role.role_name}${systemFlag}: ${role.permission_count} permissions`);
      if (role.role_description) {
        console.log(`     Description: ${role.role_description}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error setting up Role and Permission System:', error);
    throw error;
  } finally {
    // Close the database connection
    await masterSequelize.close();
  }
}

// Run the setup
setupRolePermissionSystem()
  .then(() => {
    console.log('\n🎉 Role and Permission System setup completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Role and Permission System setup failed:', error);
    process.exit(1);
  });
