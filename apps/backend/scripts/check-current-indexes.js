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

async function checkCurrentIndexes() {
  let connection;
  try {
    connection = await createConnection(dbConfig);
    console.log('✅ Connected to database successfully');

    console.log('\n🔍 Checking current indexes on tenants table...');
    const [indexes] = await connection.execute('SHOW INDEX FROM tenants');
    console.log(`📊 Total indexes on tenants table: ${indexes.length}`);
    
    if (indexes.length > 0) {
      console.log('\n📋 Current indexes:');
      indexes.forEach(idx => {
        console.log(`  - ${idx.Key_name} on ${idx.Column_name}`);
      });
    }

    // Check if we're still over the limit
    if (indexes.length > 64) {
      console.log(`\n⚠️  Still over the 64 index limit! Need to remove ${indexes.length - 64} more indexes.`);
    } else {
      console.log(`\n✅ Index count is within limits (${indexes.length}/64)`);
    }

  } catch (error) {
    console.error('❌ Error checking indexes:', error);
  } finally {
    if (connection) await connection.end();
  }
}

checkCurrentIndexes();
