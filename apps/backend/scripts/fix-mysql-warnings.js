import { createConnection } from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const dbConfig = {
  host: process.env.MYSQL_HOST || "157.245.150.54",
  port: process.env.MYSQL_PORT || 3306,
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_MASTER_DB || "fbr_master",
};

async function testMySQLConnection() {
  let connection;
  try {
    console.log("🧪 Testing MySQL2 connection with clean configuration...");

    // Test with only valid MySQL2 options
    const cleanConfig = {
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database,
      charset: "utf8mb4",
      connectTimeout: 10000,
      multipleStatements: true,
      dateStrings: true,
      bigNumberStrings: true,
      supportBigNumbers: true,
      ssl: false,
      compress: true,
    };

    connection = await createConnection(cleanConfig);
    console.log("✅ MySQL2 connection successful with clean configuration");

    // Test a simple query
    const [rows] = await connection.execute("SELECT 1 as test");
    console.log("✅ Query execution successful:", rows[0]);

    console.log("\n🎉 MySQL configuration is clean!");
    console.log("✅ No warnings should appear above.");
    console.log("✅ The following invalid options have been removed:");
    console.log("   - acquireTimeout (use pool.acquire instead)");
    console.log("   - timeout (use pool.acquire instead)");
    console.log("   - collate (use charset instead)");
  } catch (error) {
    console.error("❌ Error testing MySQL connection:", error);
  } finally {
    if (connection) await connection.end();
  }
}

testMySQLConnection();
