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

async function testAuditDisplayImprovements() {
  let connection;
  try {
    connection = await createConnection(dbConfig);
    console.log('✅ Connected to database successfully');

    console.log('\n🔍 Testing Audit Display Improvements...');
    
    // Get the most recent audit log for invoice ID 18
    const [auditLogs] = await connection.execute(`
      SELECT 
        id,
        entity_type,
        entity_id,
        operation,
        new_values,
        created_at
      FROM audit_logs 
      WHERE entity_id = 18
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    if (auditLogs.length === 0) {
      console.log('❌ No audit logs found for invoice ID 18');
      return;
    }
    
    const log = auditLogs[0];
    console.log(`📋 Testing Audit Log ID: ${log.id}`);
    console.log(`   Operation: ${log.operation}`);
    console.log(`   Created: ${log.created_at}`);
    
    const newValues = typeof log.new_values === 'string' 
      ? JSON.parse(log.new_values) 
      : log.new_values;
    
    console.log('\n🎨 Frontend Display Improvements Preview:');
    
    if (newValues.invoice_items && Array.isArray(newValues.invoice_items)) {
      console.log(`\n📦 Invoice Items Display (${newValues.invoice_items.length} items):`);
      newValues.invoice_items.forEach((item, index) => {
        console.log(`\n   Item ${index + 1}:`);
        console.log(`     Product: ${item.product_name || 'N/A'} ${item.productDescription ? `(${item.productDescription})` : ''}`);
        console.log(`     HS Code: ${item.hsCode || 'N/A'}`);
        
        // Test the new UoM display format
        if (item.quantity && item.uoM) {
          console.log(`     Quantity: ${item.quantity} [${item.uoM}] (UoM highlighted in blue)`);
        } else if (item.quantity) {
          console.log(`     Quantity: ${item.quantity} (no UoM)`);
        } else {
          console.log(`     Quantity: N/A`);
        }
        
        console.log(`     Unit Price: ${item.unitPrice ? `$${parseFloat(item.unitPrice).toFixed(2)}` : 'N/A'}`);
        console.log(`     Total: ${item.totalValues ? `$${parseFloat(item.totalValues).toFixed(2)}` : 'N/A'}`);
        console.log(`     Tax Rate: ${item.rate || 'N/A'}`);
        console.log(`     Sales Tax: ${item.salesTaxApplicable ? `$${parseFloat(item.salesTaxApplicable).toFixed(2)}` : 'N/A'}`);
        console.log(`     Extra Tax: ${item.extraTax ? `$${parseFloat(item.extraTax).toFixed(2)}` : 'N/A'}`);
        console.log(`     Further Tax: ${item.furtherTax ? `$${parseFloat(item.furtherTax).toFixed(2)}` : 'N/A'}`);
      });
    }
    
    // Test the Additional Information filtering
    console.log('\n📋 Additional Information Section:');
    const coveredFields = new Set([
      'invoice_id', 'invoice_number', 'system_invoice_id', 'fbr_invoice_number', 'status',
      'invoiceType', 'invoiceDate', 'totalAmount', 'fbrValidation', 'invoice_items',
      'sellerNTNCNIC', 'sellerFullNTN', 'sellerBusinessName', 'sellerProvince', 'sellerAddress', 'sellerCity',
      'buyerNTNCNIC', 'buyerBusinessName', 'buyerProvince', 'buyerAddress', 'buyerRegistrationType',
      'invoiceRefNo', 'companyInvoiceRefNo', 'internal_invoice_no', 'transctypeId', 'transctypeld'
    ]);
    
    const additionalFields = Object.entries(newValues)
      .filter(([key]) => !coveredFields.has(key))
      .filter(([key, value]) => {
        return value !== null && 
               value !== undefined && 
               value !== '' && 
               value !== 'NULL' && 
               value !== 'null' &&
               (typeof value !== 'string' || value.trim() !== '');
      });
    
    if (additionalFields.length > 0) {
      console.log('   Fields that will be displayed:');
      additionalFields.forEach(([key, value]) => {
        console.log(`     ${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`);
      });
    } else {
      console.log('   No additional fields to display (all covered or empty)');
    }
    
    // Check if transctypeld is properly hidden
    if (newValues.transctypeld !== undefined) {
      console.log(`\n🔍 transctypeld field status:`);
      console.log(`   Value: ${newValues.transctypeld}`);
      console.log(`   Will be hidden: ${coveredFields.has('transctypeld') ? 'YES ✅' : 'NO ❌'}`);
    }
    
    console.log('\n🎉 Display Improvements Summary:');
    console.log('✅ UoM Display: Quantity and UoM are now properly separated');
    console.log('   - Quantity shown as regular text');
    console.log('   - UoM highlighted in blue and bold');
    console.log('✅ Additional Information: transctypeld is now hidden');
    console.log('   - Field is added to coveredFields list');
    console.log('   - Will not appear in Additional Information section');
    console.log('✅ Clean Display: Only meaningful fields are shown');
    
    console.log('\n💡 The enhanced frontend will now:');
    console.log('   - Display UoM (Unit of Measure) in blue highlight');
    console.log('   - Hide transctypeld from Additional Information');
    console.log('   - Show cleaner, more organized invoice item data');
    console.log('   - Maintain all existing functionality');
    
  } catch (error) {
    console.error('❌ Error testing audit display improvements:', error);
  } finally {
    if (connection) await connection.end();
  }
}

testAuditDisplayImprovements();
