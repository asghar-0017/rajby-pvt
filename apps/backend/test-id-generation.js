#!/usr/bin/env node

/**
 * 🧪 Test System Invoice ID Generation
 * 
 * This script tests the system invoice ID generation logic to ensure
 * all generated IDs are within the 20 character limit.
 */

console.log('🧪 Testing System Invoice ID Generation...\n');

// Test the ID generation logic
function testIdGeneration() {
  const usedIds = new Set();
  const maxLength = 20;
  let maxGeneratedLength = 0;
  let totalIds = 1000; // Test with 1000 IDs
  
  console.log(`📊 Testing ${totalIds} ID generations...`);
  
  for (let i = 0; i < totalIds; i++) {
    // Generate unique system invoice ID within 20 character limit
    const timestamp = Date.now().toString().slice(-6);
    const rowNum = i.toString().padStart(3, '0');
    const randomSuffix = Math.random().toString(36).substr(2, 3);
    let systemInvoiceId = `SYS_${timestamp}_${rowNum}_${randomSuffix}`;
    
    // Ensure the ID is within the 20 character limit
    if (systemInvoiceId.length > maxLength) {
      console.error(`❌ Generated ID too long: "${systemInvoiceId}" (${systemInvoiceId.length} chars)`);
      // Fallback to shorter ID
      const fallbackId = `SYS_${i.toString().padStart(6, '0')}`;
      if (fallbackId.length > maxLength) {
        throw new Error(`Fallback system_invoice_id too long: "${fallbackId}" (${fallbackId.length} chars, max ${maxLength})`);
      }
      systemInvoiceId = fallbackId;
    }
    
    // Ensure uniqueness
    if (usedIds.has(systemInvoiceId)) {
      console.warn(`⚠️  Duplicate system_invoice_id generated: ${systemInvoiceId}, regenerating...`);
      const uniqueSuffix = Math.random().toString(36).substr(2, 4);
      systemInvoiceId = `SYS_${i.toString().padStart(6, '0')}_${uniqueSuffix}`;
      
      if (systemInvoiceId.length > maxLength) {
        systemInvoiceId = `SYS_${i.toString().padStart(6, '0')}`;
      }
    }
    
    usedIds.add(systemInvoiceId);
    
    // Track maximum length
    maxGeneratedLength = Math.max(maxGeneratedLength, systemInvoiceId.length);
    
    // Show progress every 100 IDs
    if (i % 100 === 0 && i > 0) {
      console.log(`📈 Generated ${i}/${totalIds} IDs...`);
    }
    
    // Show sample IDs
    if (i < 5 || i === 99 || i === 999) {
      console.log(`   Sample ${i + 1}: "${systemInvoiceId}" (${systemInvoiceId.length} chars)`);
    }
  }
  
  console.log(`\n✅ Test completed successfully!`);
  console.log(`📊 Results:`);
  console.log(`   - Total IDs generated: ${usedIds.size}`);
  console.log(`   - Maximum ID length: ${maxGeneratedLength} chars`);
  console.log(`   - Character limit: ${maxLength} chars`);
  console.log(`   - All IDs within limit: ${maxGeneratedLength <= maxLength ? '✅ YES' : '❌ NO'}`);
  console.log(`   - All IDs unique: ${usedIds.size === totalIds ? '✅ YES' : '❌ NO'}`);
  
  if (maxGeneratedLength > maxLength) {
    console.error(`\n❌ FAILED: Some IDs exceed the ${maxLength} character limit!`);
    process.exit(1);
  }
  
  if (usedIds.size !== totalIds) {
    console.error(`\n❌ FAILED: Duplicate IDs detected!`);
    process.exit(1);
  }
  
  console.log(`\n🎉 All tests passed! The ID generation logic is working correctly.`);
}

// Run the test
try {
  testIdGeneration();
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
