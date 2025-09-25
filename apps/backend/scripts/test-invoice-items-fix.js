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

async function testInvoiceItemsFix() {
  let connection;
  try {
    connection = await createConnection(dbConfig);
    console.log('✅ Connected to database successfully');

    // Get tenant databases
    const [tenants] = await connection.execute('SELECT id, database_name, seller_business_name FROM tenants WHERE is_active = 1');
    console.log(`📊 Found ${tenants.length} active tenants`);

    for (const tenant of tenants) {
      console.log(`\n🏢 Testing tenant: ${tenant.seller_business_name} (${tenant.database_name})`);
      
      try {
        const tenantConnection = await createConnection({ ...dbConfig, database: tenant.database_name });
        
        // Check if there are any invoices with items
        const [invoicesWithItems] = await tenantConnection.execute(`
          SELECT i.id, i.invoice_number, i.status, COUNT(ii.id) as item_count
          FROM invoices i
          LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
          GROUP BY i.id, i.invoice_number, i.status
          HAVING item_count > 0
          ORDER BY i.created_at DESC
          LIMIT 3
        `);
        
        console.log(`   📊 Found ${invoicesWithItems.length} invoices with items:`);
        invoicesWithItems.forEach(invoice => {
          console.log(`      - Invoice ${invoice.id}: ${invoice.invoice_number} (${invoice.status}) - ${invoice.item_count} items`);
        });
        
        // Check the most recent backup records
        const [recentBackups] = await tenantConnection.execute(`
          SELECT id, original_invoice_id, backup_type, 
                 JSON_LENGTH(invoice_items_data) as items_count,
                 invoice_items_data
          FROM invoice_backups 
          ORDER BY created_at DESC 
          LIMIT 5
        `);
        
        console.log(`   📋 Recent backup records:`);
        recentBackups.forEach(backup => {
          console.log(`      - Backup ${backup.id}: Invoice ${backup.original_invoice_id} (${backup.backup_type}) - ${backup.items_count} items`);
          if (backup.items_count === 0) {
            console.log(`        ⚠️  Empty invoice items: ${backup.invoice_items_data}`);
          }
        });
        
        await tenantConnection.end();
        
      } catch (error) {
        console.error(`   ❌ Error checking tenant ${tenant.database_name}:`, error.message);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (connection) await connection.end();
  }
}

testInvoiceItemsFix();
