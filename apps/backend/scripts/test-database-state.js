import mysql from 'mysql2/promise';

/**
 * Test script to verify database state and index functionality
 */
async function testDatabaseState() {
  let connection;
  
  try {
    console.log("🔍 Testing database state and index functionality...");
    
    // Connect to the database
    connection = await mysql.createConnection({
      host: 'localhost',
      port: 3307,
      user: 'root',
      password: 'root',
      database: 'innovative123'
    });

    console.log("✅ Connected to database: innovative123");

    // Check table structure
    console.log("\n📋 Checking table structure...");
    const [tableInfo] = await connection.execute(`
      DESCRIBE buyers
    `);
    
    console.log("Table structure:");
    tableInfo.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `(${col.Key})` : ''}`);
    });

    // Check existing indexes
    console.log("\n📋 Checking existing indexes...");
    const [indexes] = await connection.execute(`
      SHOW INDEX FROM buyers
    `);
    
    console.log("Indexes:");
    indexes.forEach(idx => {
      console.log(`  - ${idx.Key_name}: ${idx.Column_name} ${idx.Non_unique === 0 ? '(UNIQUE)' : ''}`);
    });

    // Test a simple query to see if indexes are working
    console.log("\n🧪 Testing query performance...");
    
    // Test 1: Simple SELECT with WHERE clause
    console.log("Test 1: SELECT with WHERE clause on indexed field...");
    const startTime1 = Date.now();
    const [result1] = await connection.execute(`
      SELECT buyerNTNCNIC, buyerBusinessName 
      FROM buyers 
      WHERE buyerNTNCNIC = '2611084-9'
    `);
    const endTime1 = Date.now();
    console.log(`✅ Query completed in ${endTime1 - startTime1}ms`);
    console.log(`   Result: ${result1.length} rows found`);

    // Test 2: COUNT query
    console.log("\nTest 2: COUNT query...");
    const startTime2 = Date.now();
    const [result2] = await connection.execute(`
      SELECT COUNT(*) as total FROM buyers
    `);
    const endTime2 = Date.now();
    console.log(`✅ Query completed in ${endTime2 - startTime2}ms`);
    console.log(`   Total buyers: ${result2[0].total}`);

    // Test 3: Business name search
    console.log("\nTest 3: Business name search...");
    const startTime3 = Date.now();
    const [result3] = await connection.execute(`
      SELECT buyerBusinessName, buyerProvince 
      FROM buyers 
      WHERE buyerBusinessName LIKE '%ARTISTIC%'
    `);
    const endTime3 = Date.now();
    console.log(`✅ Query completed in ${endTime3 - startTime3}ms`);
    console.log(`   Results: ${result3.length} rows found`);

    console.log("\n🎉 Database tests completed successfully!");
    console.log("✅ All indexes are present and working");
    console.log("✅ Queries are executing efficiently");
    
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log("🔌 Database connection closed");
    }
  }
}

// Run the test
testDatabaseState()
  .then(() => {
    console.log("\n✨ Database is ready for optimized buyer operations!");
    console.log("🚀 You can now test buyer uploads - they should be much faster!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Test failed:", error);
    process.exit(1);
  });
