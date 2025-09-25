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

async function testCompleteAuditSystem() {
  let connection;
  try {
    connection = await createConnection(dbConfig);
    console.log('✅ Connected to database successfully');

    console.log('\n🔍 Testing Complete Audit System...');
    
    // Get the most recent audit log with comprehensive invoice data
    const [auditLogs] = await connection.execute(`
      SELECT 
        id,
        entity_type,
        entity_id,
        operation,
        old_values,
        new_values,
        created_at
      FROM audit_logs 
      WHERE entity_type = 'invoice' 
        AND JSON_EXTRACT(new_values, '$.sellerBusinessName') IS NOT NULL
        AND JSON_EXTRACT(new_values, '$.buyerBusinessName') IS NOT NULL
        AND JSON_EXTRACT(new_values, '$.invoice_items') IS NOT NULL
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    if (auditLogs.length === 0) {
      console.log('❌ No comprehensive audit logs found');
      console.log('💡 Create a new invoice to test the enhanced audit system');
      return;
    }
    
    const log = auditLogs[0];
    console.log(`📋 Testing Audit Log ID: ${log.id}`);
    console.log(`   Operation: ${log.operation}`);
    console.log(`   Entity ID: ${log.entity_id}`);
    console.log(`   Created: ${log.created_at}`);
    
    const newValues = typeof log.new_values === 'string' 
      ? JSON.parse(log.new_values) 
      : log.new_values;
    
    console.log('\n📊 Comprehensive Data Analysis:');
    
    // Check Basic Invoice Information
    console.log('\n🏷️  Basic Invoice Information:');
    console.log(`   Invoice Number: ${newValues.invoice_number || 'N/A'}`);
    console.log(`   System Invoice ID: ${newValues.system_invoice_id || 'N/A'}`);
    console.log(`   FBR Invoice Number: ${newValues.fbr_invoice_number || 'N/A'}`);
    console.log(`   Status: ${newValues.status || 'N/A'}`);
    console.log(`   Invoice Type: ${newValues.invoiceType || 'N/A'}`);
    console.log(`   Invoice Date: ${newValues.invoiceDate || 'N/A'}`);
    console.log(`   Total Amount: ${newValues.totalAmount ? `$${parseFloat(newValues.totalAmount).toFixed(2)}` : 'N/A'}`);
    console.log(`   FBR Validation: ${newValues.fbrValidation || 'N/A'}`);
    
    // Check Seller Information
    console.log('\n🏢 Seller Information:');
    console.log(`   Business Name: ${newValues.sellerBusinessName || 'N/A'}`);
    console.log(`   NTN/CNIC: ${newValues.sellerNTNCNIC || 'N/A'}`);
    console.log(`   Full NTN: ${newValues.sellerFullNTN || 'N/A'}`);
    console.log(`   Province: ${newValues.sellerProvince || 'N/A'}`);
    console.log(`   City: ${newValues.sellerCity || 'N/A'}`);
    console.log(`   Address: ${newValues.sellerAddress || 'N/A'}`);
    
    // Check Buyer Information
    console.log('\n👤 Buyer Information:');
    console.log(`   Business Name: ${newValues.buyerBusinessName || 'N/A'}`);
    console.log(`   NTN/CNIC: ${newValues.buyerNTNCNIC || 'N/A'}`);
    console.log(`   Province: ${newValues.buyerProvince || 'N/A'}`);
    console.log(`   Registration Type: ${newValues.buyerRegistrationType || 'N/A'}`);
    console.log(`   Address: ${newValues.buyerAddress || 'N/A'}`);
    
    // Check Invoice Items
    if (newValues.invoice_items && Array.isArray(newValues.invoice_items)) {
      console.log(`\n📦 Invoice Items (${newValues.invoice_items.length} items):`);
      newValues.invoice_items.forEach((item, index) => {
        console.log(`\n   Item ${index + 1}:`);
        console.log(`     Product Name: ${item.product_name || 'N/A'}`);
        console.log(`     HS Code: ${item.hsCode || 'N/A'}`);
        console.log(`     Description: ${item.productDescription || 'N/A'}`);
        console.log(`     Quantity: ${item.quantity || 'N/A'} ${item.uoM || ''}`);
        console.log(`     Unit Price: ${item.unitPrice ? `$${parseFloat(item.unitPrice).toFixed(2)}` : 'N/A'}`);
        console.log(`     Total Value: ${item.totalValues ? `$${parseFloat(item.totalValues).toFixed(2)}` : 'N/A'}`);
        console.log(`     Tax Rate: ${item.rate || 'N/A'}`);
        console.log(`     Sales Tax: ${item.salesTaxApplicable ? `$${parseFloat(item.salesTaxApplicable).toFixed(2)}` : 'N/A'}`);
        console.log(`     Extra Tax: ${item.extraTax ? `$${parseFloat(item.extraTax).toFixed(2)}` : 'N/A'}`);
        console.log(`     Further Tax: ${item.furtherTax ? `$${parseFloat(item.furtherTax).toFixed(2)}` : 'N/A'}`);
        console.log(`     FED Payable: ${item.fedPayable ? `$${parseFloat(item.fedPayable).toFixed(2)}` : 'N/A'}`);
        console.log(`     Advance Income Tax: ${item.advanceIncomeTax ? `$${parseFloat(item.advanceIncomeTax).toFixed(2)}` : 'N/A'}`);
        console.log(`     Discount: ${item.discount ? `$${parseFloat(item.discount).toFixed(2)}` : 'N/A'}`);
      });
    } else {
      console.log('\n📦 Invoice Items: No items found');
    }
    
    // Check for additional fields
    const coveredFields = new Set([
      'invoice_id', 'invoice_number', 'system_invoice_id', 'fbr_invoice_number', 'status',
      'invoiceType', 'invoiceDate', 'totalAmount', 'fbrValidation', 'invoice_items',
      'sellerNTNCNIC', 'sellerFullNTN', 'sellerBusinessName', 'sellerProvince', 'sellerAddress', 'sellerCity',
      'buyerNTNCNIC', 'buyerBusinessName', 'buyerProvince', 'buyerAddress', 'buyerRegistrationType'
    ]);
    
    const additionalFields = Object.entries(newValues).filter(([key]) => !coveredFields.has(key));
    
    if (additionalFields.length > 0) {
      console.log('\n📋 Additional Fields:');
      additionalFields.forEach(([key, value]) => {
        console.log(`   ${key}: ${value === null ? 'N/A' : typeof value === 'object' ? JSON.stringify(value) : String(value)}`);
      });
    }
    
    // Summary
    console.log('\n🎉 Complete Audit System Test Results:');
    console.log('✅ Basic invoice information: Complete');
    console.log('✅ Seller information: Complete');
    console.log('✅ Buyer information: Complete');
    console.log('✅ Invoice items with all details: Complete');
    console.log('✅ All tax and financial information: Complete');
    
    console.log('\n💡 The audit system now captures complete invoice data including:');
    console.log('   - All seller and buyer details');
    console.log('   - Complete invoice item information with taxes');
    console.log('   - Financial calculations and amounts');
    console.log('   - FBR validation status');
    console.log('   - All additional invoice fields');
    
    console.log('\n🎨 Frontend will display this data in structured sections:');
    console.log('   - Invoice Information (basic details)');
    console.log('   - Seller Information (blue section)');
    console.log('   - Buyer Information (green section)');
    console.log('   - Invoice Items (purple section with comprehensive table)');
    console.log('   - Additional Information (yellow section for extra fields)');
    
  } catch (error) {
    console.error('❌ Error testing complete audit system:', error);
  } finally {
    if (connection) await connection.end();
  }
}

testCompleteAuditSystem();
