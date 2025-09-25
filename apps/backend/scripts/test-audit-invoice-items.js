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

async function testAuditInvoiceItems() {
  let connection;
  try {
    connection = await createConnection(dbConfig);
    console.log('✅ Connected to database successfully');

    console.log('\n🔍 Testing audit logs with invoice items...');
    
    // Get recent audit logs for invoices
    const [auditLogs] = await connection.execute(`
      SELECT 
        id,
        entity_type,
        entity_id,
        operation,
        new_values,
        old_values,
        changed_fields,
        created_at
      FROM audit_logs 
      WHERE entity_type = 'invoice' 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log(`📊 Found ${auditLogs.length} recent invoice audit logs`);
    
    for (const log of auditLogs) {
      console.log(`\n📋 Audit Log ID: ${log.id}`);
      console.log(`   Operation: ${log.operation}`);
      console.log(`   Entity ID: ${log.entity_id}`);
      console.log(`   Created: ${log.created_at}`);
      
      // Check if new_values contains invoice_items
      if (log.new_values) {
        const newValues = typeof log.new_values === 'string' 
          ? JSON.parse(log.new_values) 
          : log.new_values;
        
        if (newValues.invoice_items) {
          console.log(`   ✅ New Values contains invoice_items: ${newValues.invoice_items.length} items`);
          if (newValues.invoice_items.length > 0) {
            console.log(`   📦 Sample item: ${newValues.invoice_items[0].product_name || 'N/A'}`);
          }
        } else {
          console.log(`   ❌ New Values missing invoice_items`);
        }
      }
      
      // Check if old_values contains invoice_items
      if (log.old_values) {
        const oldValues = typeof log.old_values === 'string' 
          ? JSON.parse(log.old_values) 
          : log.old_values;
        
        if (oldValues.invoice_items) {
          console.log(`   ✅ Old Values contains invoice_items: ${oldValues.invoice_items.length} items`);
        } else {
          console.log(`   ❌ Old Values missing invoice_items`);
        }
      }
      
      // Check if changed_fields contains invoice_items
      if (log.changed_fields) {
        const changedFields = typeof log.changed_fields === 'string' 
          ? JSON.parse(log.changed_fields) 
          : log.changed_fields;
        
        if (changedFields.invoice_items) {
          console.log(`   ✅ Changed Fields contains invoice_items comparison`);
        }
      }
    }
    
    console.log('\n🎉 Audit invoice items test completed!');
    
  } catch (error) {
    console.error('❌ Error testing audit invoice items:', error);
  } finally {
    if (connection) await connection.end();
  }
}

testAuditInvoiceItems();
