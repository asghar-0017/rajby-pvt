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

async function checkInvoiceItemsIssue() {
  let connection;
  try {
    connection = await createConnection(dbConfig);
    console.log('✅ Connected to database successfully');

    // Get tenant databases
    const [tenants] = await connection.execute('SELECT id, database_name, seller_business_name FROM tenants WHERE is_active = 1');
    console.log(`📊 Found ${tenants.length} active tenants`);

    for (const tenant of tenants) {
      console.log(`\n🏢 Checking tenant: ${tenant.seller_business_name} (${tenant.database_name})`);
      
      try {
        const tenantConnection = await createConnection({ ...dbConfig, database: tenant.database_name });
        
        // Check the specific backup record (ID 13, original_invoice_id 16)
        const [backupRecord] = await tenantConnection.execute(`
          SELECT id, original_invoice_id, backup_type, invoice_items_data 
          FROM invoice_backups 
          WHERE id = 13 AND original_invoice_id = 16
        `);
        
        if (backupRecord.length > 0) {
          const backup = backupRecord[0];
          console.log(`   📋 Backup record found:`);
          console.log(`      - ID: ${backup.id}`);
          console.log(`      - Original Invoice ID: ${backup.original_invoice_id}`);
          console.log(`      - Backup Type: ${backup.backup_type}`);
          console.log(`      - Invoice Items Data: ${backup.invoice_items_data}`);
          
          // Check if the original invoice has items
          const [invoiceItems] = await tenantConnection.execute(`
            SELECT * FROM invoice_items WHERE invoice_id = ?
          `, [backup.original_invoice_id]);
          
          console.log(`   📊 Original invoice has ${invoiceItems.length} items:`);
          invoiceItems.forEach((item, index) => {
            console.log(`      ${index + 1}. ${item.name || 'Unnamed'} - Qty: ${item.quantity}, Price: ${item.unit_price}`);
          });
          
          // Check the invoice record itself
          const [invoice] = await tenantConnection.execute(`
            SELECT id, invoice_number, status, created_at FROM invoices WHERE id = ?
          `, [backup.original_invoice_id]);
          
          if (invoice.length > 0) {
            console.log(`   📄 Invoice details:`);
            console.log(`      - Number: ${invoice[0].invoice_number}`);
            console.log(`      - Status: ${invoice[0].status}`);
            console.log(`      - Created: ${invoice[0].created_at}`);
          }
        } else {
          console.log(`   ❌ Backup record not found`);
        }
        
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

checkInvoiceItemsIssue();
