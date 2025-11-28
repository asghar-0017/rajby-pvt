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

async function checkTenantsStructure() {
  let connection;
  try {
    connection = await createConnection(dbConfig);
    console.log("✅ Connected to database successfully");

    console.log("\n🔍 Checking tenants table structure...");

    // Check table structure
    const [columns] = await connection.execute("SHOW COLUMNS FROM tenants");
    console.log("\n📋 Table columns:");
    columns.forEach((col) => {
      console.log(
        `  - ${col.Field}: ${col.Type} ${col.Null === "NO" ? "NOT NULL" : "NULL"} ${col.Key ? `(${col.Key})` : ""}`
      );
    });

    // Check indexes
    const [indexes] = await connection.execute("SHOW INDEX FROM tenants");
    console.log("\n📋 Table indexes:");
    indexes.forEach((idx) => {
      console.log(
        `  - ${idx.Key_name}: ${idx.Column_name} (${idx.Non_unique === 0 ? "UNIQUE" : "NON-UNIQUE"})`
      );
    });

    // Check constraints
    const [constraints] = await connection.execute(
      `
      SELECT 
        CONSTRAINT_NAME,
        CONSTRAINT_TYPE,
        COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'tenants'
      ORDER BY CONSTRAINT_NAME, ORDINAL_POSITION
    `,
      [dbConfig.database]
    );

    console.log("\n📋 Table constraints:");
    constraints.forEach((constraint) => {
      console.log(
        `  - ${constraint.CONSTRAINT_NAME}: ${constraint.CONSTRAINT_TYPE} on ${constraint.COLUMN_NAME}`
      );
    });
  } catch (error) {
    console.error("❌ Error checking table structure:", error);
  } finally {
    if (connection) await connection.end();
  }
}

checkTenantsStructure();
