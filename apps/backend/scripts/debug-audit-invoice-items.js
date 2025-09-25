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

async function debugAuditInvoiceItems() {
  let connection;
  try {
    connection = await createConnection(dbConfig);
    console.log('✅ Connected to database successfully');

    console.log('\n🔍 Debugging audit invoice items...');
    
    // Get the most recent audit log with invoice items
    const [auditLogs] = await connection.execute(`
      SELECT 
        id,
        entity_type,
        entity_id,
        operation,
        new_values,
        created_at
      FROM audit_logs 
      WHERE entity_type = 'invoice' 
        AND JSON_EXTRACT(new_values, '$.invoice_items') IS NOT NULL
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    if (auditLogs.length === 0) {
      console.log('❌ No audit logs with invoice items found');
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
    
    console.log('\n📊 Raw invoice_items data:');
    console.log(JSON.stringify(newValues.invoice_items, null, 2));
    
    // Check each field
    if (newValues.invoice_items && newValues.invoice_items.length > 0) {
      const item = newValues.invoice_items[0];
      console.log('\n🔍 Field Analysis:');
      console.log(`   id: ${item.id} (${typeof item.id})`);
      console.log(`   product_name: ${item.product_name} (${typeof item.product_name})`);
      console.log(`   product_code: ${item.product_code} (${typeof item.product_code})`);
      console.log(`   quantity: ${item.quantity} (${typeof item.quantity})`);
      console.log(`   unit_price: ${item.unit_price} (${typeof item.unit_price})`);
      console.log(`   total_price: ${item.total_price} (${typeof item.total_price})`);
      console.log(`   product_description: ${item.product_description} (${typeof item.product_description})`);
      
      // Check for undefined vs null vs missing
      const undefinedFields = [];
      const nullFields = [];
      const missingFields = [];
      
      const expectedFields = ['id', 'product_name', 'product_code', 'quantity', 'unit_price', 'total_price', 'product_description'];
      
      expectedFields.forEach(field => {
        if (!(field in item)) {
          missingFields.push(field);
        } else if (item[field] === undefined) {
          undefinedFields.push(field);
        } else if (item[field] === null) {
          nullFields.push(field);
        }
      });
      
      if (undefinedFields.length > 0) {
        console.log(`\n⚠️  Undefined fields: ${undefinedFields.join(', ')}`);
      }
      if (nullFields.length > 0) {
        console.log(`\n⚠️  Null fields: ${nullFields.join(', ')}`);
      }
      if (missingFields.length > 0) {
        console.log(`\n⚠️  Missing fields: ${missingFields.join(', ')}`);
      }
      
      if (undefinedFields.length === 0 && nullFields.length === 0 && missingFields.length === 0) {
        console.log('\n✅ All fields are properly defined');
      }
    }
    
  } catch (error) {
    console.error('❌ Error debugging audit invoice items:', error);
  } finally {
    if (connection) await connection.end();
  }
}

debugAuditInvoiceItems();
