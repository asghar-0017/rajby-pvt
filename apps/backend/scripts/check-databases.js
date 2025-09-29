import mysql from "mysql2/promise";

async function checkDatabases() {
  let connection;

  try {
    console.log("🔍 Checking available databases...");

    // Connect to MySQL without specifying a database
    connection = await mysql.createConnection({
      host: "localhost",
      port: 3307,
      user: "root",
      password: "root",
      multipleStatements: true,
    });

    console.log("✅ Connected to MySQL");

    // Get all databases
    const [databases] = await connection.execute("SHOW DATABASES");

    console.log("📊 Available databases:");
    databases.forEach((db) => {
      const dbName = Object.values(db)[0]; // Get the first value from the object
      console.log(`  - ${dbName}`);
    });

    // Check for databases that might contain buyers table
    for (const db of databases) {
      const dbName = Object.values(db)[0]; // Get the first value from the object
      if (
        dbName === "information_schema" ||
        dbName === "mysql" ||
        dbName === "performance_schema" ||
        dbName === "sys"
      ) {
        continue;
      }

      try {
        await connection.execute(`USE \`${dbName}\``);
        const [tables] = await connection.execute(
          `
          SELECT TABLE_NAME 
          FROM INFORMATION_SCHEMA.TABLES 
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'buyers'
        `,
          [dbName]
        );

        if (tables.length > 0) {
          console.log(`✅ Found buyers table in database: ${dbName}`);
        } else {
          console.log(`❌ No buyers table in database: ${dbName}`);
        }
      } catch (err) {
        // Skip databases that can't be accessed
        continue;
      }
    }
  } catch (error) {
    console.error("❌ Error checking databases:", error);
  } finally {
    if (connection) {
      await connection.end();
      console.log("🔌 Database connection closed");
    }
  }
}

checkDatabases().catch(console.error);
