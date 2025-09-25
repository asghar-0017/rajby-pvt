import { createConnection } from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: process.env.MYSQL_PORT || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_MASTER_DB || 'fbr_master'
};

async function checkAuditLog33() {
  let connection;
  try {
    connection = await createConnection(dbConfig);
    console.log('✅ Connected to database successfully');

    console.log('\n🔍 Checking audit log ID 33...');
    
    // Get audit log ID 33
    const [auditLogs] = await connection.execute(`
      SELECT 
        id,
        entity_type,
        entity_id,
        operation,
        new_values,
        created_at
      FROM audit_logs 
      WHERE id = 33
    `);
    
    if (auditLogs.length === 0) {
      console.log('❌ Audit log ID 33 not found');
      return;
    }
    
    const log = auditLogs[0];
    console.log(`📋 Audit Log ID: ${log.id}`);
    console.log(`   Operation: ${log.operation}`);
    console.log(`   Entity ID: ${log.entity_id}`);
    console.log(`   Created: ${log.created_at}`);
    
    const newValues = typeof log.new_values === 'string' 
      ? JSON.parse(log.new_values) 
      : log.new_values;
    
    console.log('\n📊 Invoice Items from audit log 33:');
    if (newValues.invoice_items && newValues.invoice_items.length > 0) {
      newValues.invoice_items.forEach((item, index) => {
        console.log(`\n   Item ${index + 1}:`);
        console.log(`     id: ${item.id}`);
        console.log(`     product_name: "${item.product_name}"`);
        console.log(`     product_code: "${item.product_code}"`);
        console.log(`     quantity: ${item.quantity}`);
        console.log(`     unit_price: ${item.unit_price}`);
        console.log(`     total_price: ${item.total_price}`);
        console.log(`     product_description: "${item.product_description}"`);
      });
    } else {
      console.log('   No invoice items found');
    }
    
  } catch (error) {
    console.error('❌ Error checking audit log 33:', error);
  } finally {
    if (connection) await connection.end();
  }
}

checkAuditLog33();
