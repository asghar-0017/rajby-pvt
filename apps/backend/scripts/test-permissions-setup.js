#!/usr/bin/env node

/**
 * Test Permissions Setup
 * 
 * This script tests the auto permissions setup functionality
 */

import AutoPermissionsSetup from './auto-permissions-setup.js';
import dotenv from 'dotenv';

dotenv.config();

async function testPermissionsSetup() {
  console.log('🧪 Testing Auto Permissions Setup');
  console.log('========================================');
  
  try {
    const setup = new AutoPermissionsSetup();
    setup.silent = false; // Enable logging for testing
    
    console.log('Configuration:');
    console.log(`  Silent mode: ${setup.silent}`);
    console.log(`  Auto sync enabled: ${process.env.AUTO_SCHEMA_SYNC !== 'false'}`);
    console.log('');
    
    const result = await setup.run();
    
    console.log('\n========================================');
    console.log('📊 TEST RESULTS');
    console.log('========================================');
    
    if (result.success) {
      console.log('✅ Auto permissions setup test PASSED');
      console.log(`   Duration: ${result.duration}ms`);
      console.log(`   Permissions created: ${result.results.permissionsCreated}`);
      console.log(`   Permissions updated: ${result.results.permissionsUpdated}`);
      if (result.results.errors.length > 0) {
        console.log(`   Errors: ${result.results.errors.length}`);
        result.results.errors.forEach(error => console.log(`     - ${error}`));
      }
    } else {
      console.log('❌ Auto permissions setup test FAILED');
      console.log(`   Error: ${result.error}`);
      console.log(`   Duration: ${result.duration}ms`);
    }
    
  } catch (error) {
    console.log('\n========================================');
    console.log('📊 TEST RESULTS');
    console.log('========================================');
    console.log('❌ Auto permissions setup test FAILED');
    console.log(`   Error: ${error.message}`);
  }
}

testPermissionsSetup();
