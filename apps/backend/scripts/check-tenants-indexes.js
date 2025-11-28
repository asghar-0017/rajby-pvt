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

async function checkTenantsIndexes() {
  let connection;
  try {
    connection = await createConnection(dbConfig);
    console.log("✅ Connected to database successfully");

    console.log("\n🔍 Checking tenants table indexes...");

    const [indexes] = await connection.execute("SHOW INDEX FROM tenants");
    console.log(`📊 Total indexes: ${indexes.length}`);

    if (indexes.length > 64) {
      console.log(
        `⚠️  Table has ${indexes.length} indexes (over the 64 limit)`
      );

      // Group indexes by column name
      const indexGroups = {};
      indexes.forEach((idx) => {
        if (!indexGroups[idx.Column_name]) {
          indexGroups[idx.Column_name] = [];
        }
        indexGroups[idx.Column_name].push(idx.Key_name);
      });

      console.log("\n📋 Index groups:");
      Object.entries(indexGroups).forEach(([column, indexNames]) => {
        console.log(
          `  - ${column}: ${indexNames.length} indexes (${indexNames.join(", ")})`
        );
      });

      // Remove duplicate indexes, keeping only the first one
      for (const [columnName, indexNames] of Object.entries(indexGroups)) {
        if (indexNames.length > 1) {
          console.log(
            `\n🔍 Column ${columnName} has ${indexNames.length} indexes: ${indexNames.join(", ")}`
          );

          // Keep the first index, remove the rest
          const indexesToRemove = indexNames.slice(1);

          for (const indexName of indexesToRemove) {
            try {
              console.log(`   🗑️  Removing duplicate index: ${indexName}`);
              await connection.execute(
                `ALTER TABLE tenants DROP INDEX \`${indexName}\``
              );
              console.log(`   ✅ Removed ${indexName}`);
            } catch (error) {
              console.log(
                `   ❌ Failed to remove ${indexName}: ${error.message}`
              );
            }
          }
        }
      }

      // Check final index count
      const [finalIndexes] = await connection.execute(
        "SHOW INDEX FROM tenants"
      );
      console.log(`\n📊 Final index count: ${finalIndexes.length}`);

      if (finalIndexes.length <= 64) {
        console.log("✅ Index cleanup successful! Table is now within limits.");
      } else {
        console.log(
          "⚠️  Still over the limit. Additional cleanup may be needed."
        );
      }
    } else {
      console.log(`✅ Table is within limits (${indexes.length}/64)`);
    }
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
  } finally {
    if (connection) await connection.end();
  }
}

checkTenantsIndexes();
