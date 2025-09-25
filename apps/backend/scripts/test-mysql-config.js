import { masterSequelize, createTenantConnection } from '../src/config/mysql.js';
import dotenv from 'dotenv';

dotenv.config();

async function testMySQLConfig() {
  console.log('🧪 Testing MySQL Configuration...');
  
  try {
    // Test master connection
    console.log('\n📡 Testing master database connection...');
    await masterSequelize.authenticate();
    console.log('✅ Master database connection successful (no warnings expected)');
    
    // Test tenant connection
    console.log('\n📡 Testing tenant database connection...');
    const tenantSequelize = createTenantConnection('test_tenant');
    await tenantSequelize.authenticate();
    console.log('✅ Tenant database connection successful (no warnings expected)');
    
    // Close connections
    await masterSequelize.close();
    await tenantSequelize.close();
    
    console.log('\n🎉 All MySQL connections tested successfully!');
    console.log('✅ No configuration warnings should appear above.');
    
  } catch (error) {
    console.error('❌ Error testing MySQL configuration:', error);
  }
}

testMySQLConfig();
