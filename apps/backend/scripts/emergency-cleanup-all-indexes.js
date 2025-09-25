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

async function emergencyCleanupAllIndexes() {
  let connection;
  try {
    connection = await createConnection(dbConfig);
    console.log('✅ Connected to database successfully');

    console.log('\n🚨 EMERGENCY CLEANUP: Removing duplicate indexes from all problematic tables...');
    
    // List of tables that need cleanup (those with 64 indexes)
    const problematicTables = ['users', 'roles', 'permissions', 'audit_permissions'];
    
    for (const tableName of problematicTables) {
      console.log(`\n🔍 Processing table: ${tableName}`);
      
      // Get current index count
      const [indexCount] = await connection.execute(`
        SELECT COUNT(*) as count 
        FROM information_schema.statistics 
        WHERE table_schema = ? AND table_name = ?
      `, [dbConfig.database, tableName]);
      
      console.log(`   Current index count: ${indexCount[0].count}`);
      
      if (indexCount[0].count <= 10) {
        console.log(`   ✅ ${tableName} index count is already low, skipping`);
        continue;
      }
      
      // Get all indexes except PRIMARY
      const [indexes] = await connection.execute(`
        SELECT INDEX_NAME, COLUMN_NAME
        FROM information_schema.statistics 
        WHERE table_schema = ? AND table_name = ? AND INDEX_NAME != 'PRIMARY'
        ORDER BY INDEX_NAME
      `, [dbConfig.database, tableName]);
      
      console.log(`   Found ${indexes.length} non-primary indexes to clean up`);
      
      // Group indexes by column
      const columnIndexes = {};
      indexes.forEach(index => {
        if (!columnIndexes[index.COLUMN_NAME]) {
          columnIndexes[index.COLUMN_NAME] = [];
        }
        columnIndexes[index.COLUMN_NAME].push(index.INDEX_NAME);
      });
      
      // Keep only the first index for each column, remove the rest
      let removedCount = 0;
      for (const [column, indexNames] of Object.entries(columnIndexes)) {
        if (indexNames.length > 1) {
          // Keep the first index, remove the rest
          const indexesToRemove = indexNames.slice(1);
          
          for (const indexName of indexesToRemove) {
            try {
              console.log(`   🗑️  Removing index: ${indexName} on column ${column}`);
              await connection.execute(`DROP INDEX \`${indexName}\` ON \`${tableName}\``);
              removedCount++;
            } catch (error) {
              console.log(`   ⚠️  Could not remove index ${indexName}: ${error.message}`);
            }
          }
        }
      }
      
      // Get final index count
      const [finalIndexCount] = await connection.execute(`
        SELECT COUNT(*) as count 
        FROM information_schema.statistics 
        WHERE table_schema = ? AND table_name = ?
      `, [dbConfig.database, tableName]);
      
      console.log(`   🎉 ${tableName} cleanup completed!`);
      console.log(`      Indexes removed: ${removedCount}`);
      console.log(`      Final index count: ${finalIndexCount[0].count}`);
    }
    
    // Final summary
    console.log('\n📊 Final Index Summary:');
    const [allTables] = await connection.execute(`
      SELECT 
        table_name,
        COUNT(*) as index_count
      FROM information_schema.statistics 
      WHERE table_schema = ?
      GROUP BY table_name
      ORDER BY index_count DESC
    `, [dbConfig.database]);
    
    allTables.forEach(table => {
      const status = table.index_count <= 10 ? '✅' : table.index_count <= 20 ? '⚠️' : '❌';
      console.log(`   ${status} ${table.table_name}: ${table.index_count} indexes`);
    });
    
    console.log('\n🎉 Emergency cleanup completed!');
    
  } catch (error) {
    console.error('❌ Error during emergency cleanup:', error);
  } finally {
    if (connection) await connection.end();
  }
}

emergencyCleanupAllIndexes();
