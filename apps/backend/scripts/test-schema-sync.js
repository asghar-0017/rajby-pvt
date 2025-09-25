import AutoSchemaSync from './auto-schema-sync.js';

async function testSchemaSync() {
  console.log('🧪 Testing Auto Schema Sync...');
  
  const sync = new AutoSchemaSync();
  sync.silent = false; // Force verbose output
  
  try {
    const result = await sync.run({ keepConnectionOpen: false });
    
    console.log('\n📊 Test Results:');
    console.log(`Success: ${result.success}`);
    console.log(`Duration: ${result.duration}ms`);
    console.log(`Tables Created: ${result.results.tablesCreated}`);
    console.log(`Columns Added: ${result.results.columnsAdded}`);
    console.log(`Permissions Created: ${result.results.permissionsCreated}`);
    console.log(`Permissions Updated: ${result.results.permissionsUpdated}`);
    console.log(`Errors: ${result.results.errors.length}`);
    console.log(`Warnings: ${result.results.warnings.length}`);
    
    if (result.results.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.results.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    if (result.results.warnings.length > 0) {
      console.log('\n⚠️ Warnings:');
      result.results.warnings.forEach(warning => console.log(`  - ${warning}`));
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testSchemaSync();
