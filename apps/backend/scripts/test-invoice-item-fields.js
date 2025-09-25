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

async function testInvoiceItemFields() {
  let connection;
  try {
    connection = await createConnection(dbConfig);
    console.log('✅ Connected to database successfully');

    console.log('\n🔍 Testing invoice item field mapping...');
    
    // Get a tenant database to test with
    const [tenants] = await connection.execute('SELECT id, database_name FROM tenants LIMIT 1');
    
    if (tenants.length === 0) {
      console.log('❌ No tenants found');
      return;
    }
    
    const tenant = tenants[0];
    console.log(`📊 Testing with tenant: ${tenant.database_name}`);
    
    // Connect to tenant database
    const tenantConnection = await createConnection({
      ...dbConfig,
      database: tenant.database_name
    });
    
    // Get a sample invoice with items
    const [invoices] = await tenantConnection.execute(`
      SELECT i.id, i.invoice_number, i.system_invoice_id 
      FROM invoices i 
      WHERE EXISTS (
        SELECT 1 FROM invoice_items ii WHERE ii.invoice_id = i.id
      )
      LIMIT 1
    `);
    
    if (invoices.length === 0) {
      console.log('❌ No invoices with items found');
      await tenantConnection.end();
      return;
    }
    
    const invoice = invoices[0];
    console.log(`📋 Testing with invoice: ${invoice.invoice_number} (ID: ${invoice.id})`);
    
    // Get invoice items
    const [items] = await tenantConnection.execute(`
      SELECT 
        id,
        name,
        hsCode,
        productDescription,
        quantity,
        unitPrice,
        totalValues,
        rate,
        uoM
      FROM invoice_items 
      WHERE invoice_id = ?
    `, [invoice.id]);
    
    console.log(`📦 Found ${items.length} invoice items`);
    
    if (items.length > 0) {
      const sampleItem = items[0];
      console.log('\n📊 Sample Invoice Item Fields:');
      console.log(`   id: ${sampleItem.id}`);
      console.log(`   name: ${sampleItem.name || 'NULL'}`);
      console.log(`   hsCode: ${sampleItem.hsCode || 'NULL'}`);
      console.log(`   productDescription: ${sampleItem.productDescription || 'NULL'}`);
      console.log(`   quantity: ${sampleItem.quantity || 'NULL'}`);
      console.log(`   unitPrice: ${sampleItem.unitPrice || 'NULL'}`);
      console.log(`   totalValues: ${sampleItem.totalValues || 'NULL'}`);
      console.log(`   rate: ${sampleItem.rate || 'NULL'}`);
      console.log(`   uoM: ${sampleItem.uoM || 'NULL'}`);
      
      console.log('\n🔄 Field Mapping Test:');
      const mappedItem = {
        id: sampleItem.id,
        product_name: sampleItem.name,
        quantity: sampleItem.quantity,
        unit_price: sampleItem.unitPrice,
        total_price: sampleItem.totalValues,
        product_code: sampleItem.hsCode,
        product_description: sampleItem.productDescription
      };
      
      console.log('   Mapped fields:');
      console.log(`   product_name: ${mappedItem.product_name || 'NULL'}`);
      console.log(`   product_code: ${mappedItem.product_code || 'NULL'}`);
      console.log(`   quantity: ${mappedItem.quantity || 'NULL'}`);
      console.log(`   unit_price: ${mappedItem.unit_price || 'NULL'}`);
      console.log(`   total_price: ${mappedItem.total_price || 'NULL'}`);
      console.log(`   product_description: ${mappedItem.product_description || 'NULL'}`);
      
      // Check for N/A values
      const hasNAValues = Object.values(mappedItem).some(value => 
        value === null || value === undefined || value === 'NULL'
      );
      
      if (hasNAValues) {
        console.log('\n⚠️  Some fields are NULL/undefined - this will show as N/A in the UI');
        console.log('   This is expected if the invoice items have missing data');
      } else {
        console.log('\n✅ All fields have values - should display properly in the UI');
      }
    }
    
    await tenantConnection.end();
    console.log('\n🎉 Invoice item field mapping test completed!');
    
  } catch (error) {
    console.error('❌ Error testing invoice item fields:', error);
  } finally {
    if (connection) await connection.end();
  }
}

testInvoiceItemFields();
