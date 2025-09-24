#!/usr/bin/env node

/**
 * Test Auto Schema Sync
 * 
 * This script tests if the auto schema sync is working correctly.
 */

import AutoSchemaSync from './auto-schema-sync.js';
import dotenv from 'dotenv';

dotenv.config();

async function testAutoSync() {
  console.log('🧪 Testing Auto Schema Sync');
  console.log('='.repeat(40));
  
  // Create a non-silent instance for testing
  const sync = new AutoSchemaSync();
  sync.silent = false; // Force verbose output
  
  console.log('Configuration:');
  console.log(`  Silent mode: ${sync.silent}`);
  console.log(`  Max retries: ${sync.maxRetries}`);
  console.log(`  Retry delay: ${sync.retryDelay}ms`);
  console.log(`  Auto sync enabled: ${process.env.AUTO_SCHEMA_SYNC !== 'false'}`);
  console.log('');
  
  try {
    const result = await sync.run();
    
    console.log('\n' + '='.repeat(40));
    console.log('📊 TEST RESULTS');
    console.log('='.repeat(40));
    
    if (result.success) {
      console.log('✅ Auto schema sync test PASSED');
      console.log(`   Duration: ${result.duration}ms`);
      console.log(`   Tables synchronized: ${result.results.tablesCreated}`);
      console.log(`   Columns added: ${result.results.columnsAdded}`);
      
      if (result.results.warnings.length > 0) {
        console.log(`   Warnings: ${result.results.warnings.length}`);
        result.results.warnings.forEach(warning => console.log(`     - ${warning}`));
      }
      
      if (result.results.errors.length > 0) {
        console.log(`   Errors: ${result.results.errors.length}`);
        result.results.errors.forEach(error => console.log(`     - ${error}`));
      }
    } else {
      console.log('❌ Auto schema sync test FAILED');
      console.log(`   Error: ${result.error}`);
      console.log(`   Duration: ${result.duration}ms`);
    }
    
    return result.success;
    
  } catch (error) {
    console.error('❌ Test failed with exception:', error.message);
    return false;
  }
}

// Run the test
testAutoSync()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal test error:', error);
    process.exit(1);
  });
