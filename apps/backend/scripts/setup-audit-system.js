import mysql from "mysql2/promise";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const connectionConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'Jsab43#%87dgDJ49bf^9b',
  database: process.env.MYSQL_MASTER_DB || 'fbr_integration',
  port: process.env.MYSQL_PORT || 3306
};

async function setupAuditSystem() {
  let connection;
  try {
    console.log('🔧 Setting up Audit System...');
    console.log('Connecting to database...');
    
    connection = await mysql.createConnection(connectionConfig);
    console.log('✅ Connected to database');

    // Execute audit system SQL files in order
    const sqlFiles = [
      'create-audit-tables.sql',
      'create-audit-summary.sql', 
      'create-audit-permissions.sql',
      'insert-audit-permissions.sql',
      'assign-audit-permissions.sql'
    ];

    console.log(`📝 Executing ${sqlFiles.length} SQL files...`);
    
    for (let i = 0; i < sqlFiles.length; i++) {
      const sqlFile = sqlFiles[i];
      const sqlFilePath = path.join(__dirname, sqlFile);
      
      if (fs.existsSync(sqlFilePath)) {
        const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
        
        try {
          await connection.query(sqlContent);
          console.log(`✅ File ${i + 1}/${sqlFiles.length} (${sqlFile}) executed successfully`);
        } catch (error) {
          if (error.code === 'ER_TABLE_EXISTS_ERROR' || 
              error.code === 'ER_DUP_KEYNAME' || 
              error.code === 'ER_DUP_ENTRY' ||
              error.message.includes('already exists') ||
              error.message.includes('Duplicate key name')) {
            console.log(`⚠️  File ${i + 1}/${sqlFiles.length} (${sqlFile}) skipped (already exists)`);
          } else {
            console.error(`❌ Error executing file ${i + 1}/${sqlFiles.length} (${sqlFile}):`, error.message);
            throw error;
          }
        }
      } else {
        console.log(`⚠️  File ${sqlFile} not found, skipping...`);
      }
    }

    console.log('🎉 Audit system setup completed successfully!');
    
    // Verify the setup
    console.log('\n🔍 Verifying audit system setup...');
    
    // Check if audit_logs table exists
    const [auditLogsTable] = await connection.execute(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_schema = DATABASE() AND table_name = 'audit_logs'
    `);
    
    if (auditLogsTable[0].count > 0) {
      console.log('✅ audit_logs table created successfully');
    } else {
      console.log('❌ audit_logs table not found');
    }

    // Check if audit_summary table exists
    const [auditSummaryTable] = await connection.execute(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_schema = DATABASE() AND table_name = 'audit_summary'
    `);
    
    if (auditSummaryTable[0].count > 0) {
      console.log('✅ audit_summary table created successfully');
    } else {
      console.log('❌ audit_summary table not found');
    }

    // Check if audit_permissions table exists
    const [auditPermissionsTable] = await connection.execute(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_schema = DATABASE() AND table_name = 'audit_permissions'
    `);
    
    if (auditPermissionsTable[0].count > 0) {
      console.log('✅ audit_permissions table created successfully');
    } else {
      console.log('❌ audit_permissions table not found');
    }

    // Check audit permissions
    const [auditPermissions] = await connection.execute(`
      SELECT permission_name, display_name FROM audit_permissions
    `);
    
    console.log(`✅ ${auditPermissions.length} audit permissions created:`);
    auditPermissions.forEach(perm => {
      console.log(`   - ${perm.permission_name}: ${perm.display_name}`);
    });

    // Check role permissions
    const [rolePermissions] = await connection.execute(`
      SELECT r.name as role_name, p.permission_name 
      FROM role_permissions rp
      JOIN roles r ON rp.role_id = r.id
      JOIN audit_permissions p ON rp.permission_id = p.id
      WHERE p.permission_name LIKE 'view_audit%' OR p.permission_name = 'export_audit_logs'
    `);
    
    console.log(`✅ ${rolePermissions.length} audit permissions assigned to roles:`);
    rolePermissions.forEach(rp => {
      console.log(`   - ${rp.role_name}: ${rp.permission_name}`);
    });

    console.log('\n🎯 Audit system is ready!');
    console.log('📋 Available audit permissions:');
    console.log('   - view_audit_logs: View audit trail for all operations');
    console.log('   - view_audit_summary: View audit summary for entities');
    console.log('   - export_audit_logs: Export audit logs to files');
    console.log('   - view_user_audit: View audit logs for user management operations');
    console.log('   - view_invoice_audit: View audit logs for invoice operations');
    console.log('   - view_buyer_audit: View audit logs for buyer operations');
    console.log('   - view_product_audit: View audit logs for product operations');
    
    console.log('\n🚀 Next steps:');
    console.log('   1. Restart your backend server to load the new audit models');
    console.log('   2. Access the audit management interface at /audit-management');
    console.log('   3. All CRUD operations will now be automatically audited');

  } catch (error) {
    console.error('❌ Error setting up audit system:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the setup
setupAuditSystem()
  .then(() => {
    console.log('✅ Audit system setup completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Audit system setup failed:', error);
    process.exit(1);
  });
