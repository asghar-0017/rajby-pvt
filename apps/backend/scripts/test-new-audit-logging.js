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

async function testNewAuditLogging() {
  let connection;
  try {
    connection = await createConnection(dbConfig);
    console.log('✅ Connected to database successfully');

    console.log('\n🔍 Testing new audit logging with invoice items...');
    
    // Get the most recent audit log for invoices
    const [recentLogs] = await connection.execute(`
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
      LIMIT 1
    `);
    
    if (recentLogs.length === 0) {
      console.log('❌ No invoice audit logs found');
      return;
    }
    
    const log = recentLogs[0];
    console.log(`📋 Most Recent Audit Log ID: ${log.id}`);
    console.log(`   Operation: ${log.operation}`);
    console.log(`   Entity ID: ${log.entity_id}`);
    console.log(`   Created: ${log.created_at}`);
    
    // Check new_values structure
    if (log.new_values) {
      const newValues = typeof log.new_values === 'string' 
        ? JSON.parse(log.new_values) 
        : log.new_values;
      
      console.log('\n📊 New Values Structure:');
      console.log(`   Fields: ${Object.keys(newValues).join(', ')}`);
      
      if (newValues.invoice_items) {
        console.log(`   ✅ invoice_items: ${newValues.invoice_items.length} items`);
        if (newValues.invoice_items.length > 0) {
          const sampleItem = newValues.invoice_items[0];
          console.log(`   📦 Sample item structure:`, {
            id: sampleItem.id,
            product_name: sampleItem.product_name,
            quantity: sampleItem.quantity,
            unit_price: sampleItem.unit_price,
            total_price: sampleItem.total_price
          });
        }
      } else {
        console.log(`   ❌ invoice_items: Missing`);
      }
    }
    
    // Check old_values structure
    if (log.old_values) {
      const oldValues = typeof log.old_values === 'string' 
        ? JSON.parse(log.old_values) 
        : log.old_values;
      
      console.log('\n📊 Old Values Structure:');
      console.log(`   Fields: ${Object.keys(oldValues).join(', ')}`);
      
      if (oldValues.invoice_items) {
        console.log(`   ✅ invoice_items: ${oldValues.invoice_items.length} items`);
      } else {
        console.log(`   ❌ invoice_items: Missing`);
      }
    }
    
    console.log('\n💡 To see the new audit logging in action:');
    console.log('   1. Create a new invoice through the UI');
    console.log('   2. Update an existing invoice');
    console.log('   3. Check the audit management page');
    console.log('   4. The invoice items should now be displayed in structured tables');
    
  } catch (error) {
    console.error('❌ Error testing new audit logging:', error);
  } finally {
    if (connection) await connection.end();
  }
}

testNewAuditLogging();
