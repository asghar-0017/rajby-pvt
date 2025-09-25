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

async function cleanupTenantsDuplicates() {
  let connection;
  try {
    connection = await createConnection(dbConfig);
    console.log('✅ Connected to database successfully');

    console.log('\n🧹 Cleaning up tenants duplicate indexes...');
    
    // Get all indexes
    const [indexes] = await connection.execute('SHOW INDEX FROM tenants');
    console.log(`📊 Found ${indexes.length} indexes`);
    
    // Find all duplicate indexes on tenant_id column
    const tenantIdDuplicates = indexes
      .filter(idx => idx.Column_name === 'tenant_id' && idx.Key_name !== 'tenant_id')
      .map(idx => idx.Key_name);
    
    // Find all duplicate indexes on seller_ntn_cnic column
    const sellerNtnCnicDuplicates = indexes
      .filter(idx => idx.Column_name === 'seller_ntn_cnic' && idx.Key_name !== 'seller_ntn_cnic')
      .map(idx => idx.Key_name);
    
    const allDuplicates = [...tenantIdDuplicates, ...sellerNtnCnicDuplicates];
    
    console.log(`🔍 Found ${allDuplicates.length} duplicate indexes to remove:`);
    console.log(`  - tenant_id duplicates: ${tenantIdDuplicates.length}`);
    console.log(`  - seller_ntn_cnic duplicates: ${sellerNtnCnicDuplicates.length}`);
    
    // Remove all duplicate indexes
    let removedCount = 0;
    for (const indexName of allDuplicates) {
      try {
        console.log(`🗑️  Removing duplicate index: ${indexName}`);
        await connection.execute(`ALTER TABLE tenants DROP INDEX \`${indexName}\``);
        removedCount++;
        console.log(`✅ Removed ${indexName}`);
      } catch (error) {
        console.log(`❌ Failed to remove ${indexName}: ${error.message}`);
      }
    }
    
    // Check final index count
    const [finalIndexes] = await connection.execute('SHOW INDEX FROM tenants');
    console.log(`\n📊 Final index count: ${finalIndexes.length}`);
    console.log(`✅ Removed ${removedCount} duplicate indexes`);
    
    if (finalIndexes.length <= 64) {
      console.log('🎉 Success! Table is now within the 64 index limit.');
    } else {
      console.log('⚠️  Still over the limit. Additional cleanup may be needed.');
    }

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    if (connection) await connection.end();
  }
}

cleanupTenantsDuplicates();
