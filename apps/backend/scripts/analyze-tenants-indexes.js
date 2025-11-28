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

async function analyzeTenantsIndexes() {
  let connection;
  try {
    connection = await createConnection(dbConfig);
    console.log("✅ Connected to database successfully");

    console.log("\n🔍 Analyzing tenants table indexes...");

    const [indexes] = await connection.execute("SHOW INDEX FROM tenants");
    console.log(`📊 Total indexes: ${indexes.length}`);

    // Group by index name to see duplicates
    const indexGroups = {};
    indexes.forEach((idx) => {
      if (!indexGroups[idx.Key_name]) {
        indexGroups[idx.Key_name] = [];
      }
      indexGroups[idx.Key_name].push(idx.Column_name);
    });

    console.log("\n📋 All indexes:");
    Object.entries(indexGroups).forEach(([indexName, columns]) => {
      console.log(`  - ${indexName}: ${columns.join(", ")}`);
    });

    // Check for potential duplicates or redundant indexes
    const columnUsage = {};
    indexes.forEach((idx) => {
      if (!columnUsage[idx.Column_name]) {
        columnUsage[idx.Column_name] = [];
      }
      columnUsage[idx.Column_name].push(idx.Key_name);
    });

    console.log("\n🔍 Columns with multiple indexes:");
    Object.entries(columnUsage).forEach(([column, indexNames]) => {
      if (indexNames.length > 1) {
        console.log(
          `  - ${column}: ${indexNames.join(", ")} (${indexNames.length} indexes)`
        );
      }
    });

    // Check table structure
    const [columns] = await connection.execute("SHOW COLUMNS FROM tenants");
    console.log(`\n📊 Table has ${columns.length} columns`);

    // Calculate potential index reduction
    const totalColumns = columns.length;
    const totalIndexes = indexes.length;
    const potentialReduction = totalIndexes - totalColumns;

    console.log(`\n📈 Analysis:`);
    console.log(`  - Columns: ${totalColumns}`);
    console.log(`  - Indexes: ${totalIndexes}`);
    console.log(`  - Potential reduction: ${potentialReduction} indexes`);

    if (totalIndexes > totalColumns * 2) {
      console.log(
        `  ⚠️  High index-to-column ratio (${(totalIndexes / totalColumns).toFixed(1)}x)`
      );
    }
  } catch (error) {
    console.error("❌ Error during analysis:", error);
  } finally {
    if (connection) await connection.end();
  }
}

analyzeTenantsIndexes();
