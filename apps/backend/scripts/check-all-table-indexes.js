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

async function checkAllTableIndexes() {
  let connection;
  try {
    connection = await createConnection(dbConfig);
    console.log('✅ Connected to database successfully');

    console.log('\n🔍 Checking all tables for index counts...');
    const [tablesResult] = await connection.execute('SHOW TABLES');
    const tables = tablesResult.map(row => Object.values(row)[0]);
    
    let totalIndexes = 0;
    let problematicTables = [];

    for (const table of tables) {
      const [indexes] = await connection.execute(`SHOW INDEX FROM \`${table}\``);
      totalIndexes += indexes.length;
      
      if (indexes.length > 64) {
        problematicTables.push({ table, count: indexes.length });
        console.log(`⚠️  Table ${table}: ${indexes.length} indexes (OVER LIMIT!)`);
      } else if (indexes.length > 20) {
        console.log(`📊 Table ${table}: ${indexes.length} indexes (high but OK)`);
      } else {
        console.log(`✅ Table ${table}: ${indexes.length} indexes`);
      }
    }

    console.log(`\n📊 Total indexes across all tables: ${totalIndexes}`);
    
    if (problematicTables.length > 0) {
      console.log('\n⚠️  Problematic tables:');
      problematicTables.forEach(({ table, count }) => {
        console.log(`  - ${table}: ${count} indexes`);
      });
    } else {
      console.log('\n✅ All tables are within index limits');
    }

  } catch (error) {
    console.error('❌ Error checking indexes:', error);
  } finally {
    if (connection) await connection.end();
  }
}

checkAllTableIndexes();
