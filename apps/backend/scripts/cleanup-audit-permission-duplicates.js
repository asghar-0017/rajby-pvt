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

async function cleanupAuditPermissionDuplicates() {
  let connection;
  try {
    connection = await createConnection(dbConfig);
    console.log("✅ Connected to database successfully");

    console.log("\n🧹 Cleaning up audit_permissions duplicate indexes...");

    // Get all indexes
    const [indexes] = await connection.execute(
      "SHOW INDEX FROM audit_permissions"
    );
    console.log(`📊 Found ${indexes.length} indexes`);

    // Find all duplicate indexes on permission_name column
    const duplicateIndexes = indexes
      .filter(
        (idx) =>
          idx.Column_name === "permission_name" &&
          idx.Key_name !== "permission_name"
      )
      .map((idx) => idx.Key_name);

    console.log(
      `🔍 Found ${duplicateIndexes.length} duplicate indexes to remove:`
    );
    duplicateIndexes.forEach((name) => console.log(`  - ${name}`));

    // Remove all duplicate indexes
    let removedCount = 0;
    for (const indexName of duplicateIndexes) {
      try {
        console.log(`🗑️  Removing duplicate index: ${indexName}`);
        await connection.execute(
          `ALTER TABLE audit_permissions DROP INDEX \`${indexName}\``
        );
        removedCount++;
        console.log(`✅ Removed ${indexName}`);
      } catch (error) {
        console.log(`❌ Failed to remove ${indexName}: ${error.message}`);
      }
    }

    // Check final index count
    const [finalIndexes] = await connection.execute(
      "SHOW INDEX FROM audit_permissions"
    );
    console.log(`\n📊 Final index count: ${finalIndexes.length}`);
    console.log(`✅ Removed ${removedCount} duplicate indexes`);

    if (finalIndexes.length <= 64) {
      console.log("🎉 Success! Table is now within the 64 index limit.");
    } else {
      console.log(
        "⚠️  Still over the limit. Additional cleanup may be needed."
      );
    }
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
  } finally {
    if (connection) await connection.end();
  }
}

cleanupAuditPermissionDuplicates();
