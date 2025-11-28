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

async function checkAuditLog18() {
  let connection;
  try {
    connection = await createConnection(dbConfig);
    console.log("✅ Connected to database successfully");

    console.log("\n🔍 Checking audit log for invoice #18...");

    // Get audit logs for invoice ID 18
    const [auditLogs] = await connection.execute(`
      SELECT 
        id,
        entity_type,
        entity_id,
        operation,
        old_values,
        new_values,
        created_at
      FROM audit_logs 
      WHERE entity_id = 18
      ORDER BY created_at DESC
    `);

    if (auditLogs.length === 0) {
      console.log("❌ No audit logs found for invoice ID 18");
      return;
    }

    console.log(`📊 Found ${auditLogs.length} audit logs for invoice ID 18`);

    auditLogs.forEach((log, index) => {
      console.log(`\n📋 Audit Log ${index + 1} (ID: ${log.id}):`);
      console.log(`   Operation: ${log.operation}`);
      console.log(`   Created: ${log.created_at}`);

      const newValues =
        typeof log.new_values === "string"
          ? JSON.parse(log.new_values)
          : log.new_values;

      console.log("\n📊 Available Fields in new_values:");
      Object.keys(newValues).forEach((key) => {
        const value = newValues[key];
        if (value === null || value === undefined || value === "") {
          console.log(
            `   ❌ ${key}: ${value === null ? "null" : value === undefined ? "undefined" : "empty string"}`
          );
        } else {
          console.log(
            `   ✅ ${key}: ${typeof value === "object" ? `[${Array.isArray(value) ? "array" : "object"}]` : String(value).substring(0, 50)}`
          );
        }
      });

      // Check for missing fields that should be present
      const expectedFields = [
        "invoiceRefNo",
        "companyInvoiceRefNo",
        "internal_invoice_no",
        "transctypeId",
        "sellerFullNTN",
        "sellerCity",
        "buyerCity",
      ];

      console.log("\n🔍 Missing Expected Fields:");
      expectedFields.forEach((field) => {
        if (
          !(field in newValues) ||
          newValues[field] === null ||
          newValues[field] === undefined ||
          newValues[field] === ""
        ) {
          console.log(`   ❌ ${field}: Missing or empty`);
        } else {
          console.log(`   ✅ ${field}: ${newValues[field]}`);
        }
      });
    });
  } catch (error) {
    console.error("❌ Error checking audit log 18:", error);
  } finally {
    if (connection) await connection.end();
  }
}

checkAuditLog18();
