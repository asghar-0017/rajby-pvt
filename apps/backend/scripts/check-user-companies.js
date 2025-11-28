import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const connectionConfig = {
  host: process.env.MYSQL_HOST || "157.245.150.54",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "Jsab43#%87dgDJ49bf^9b",
  database: process.env.MYSQL_MASTER_DB || "fbr_integration",
  port: process.env.MYSQL_PORT || 3306,
};

async function checkUserCompanies() {
  let connection;
  try {
    console.log("🔍 Checking user company assignments...");
    connection = await mysql.createConnection(connectionConfig);
    console.log("Connected to database");

    // Check user's company assignments
    const [userAssignments] = await connection.execute(`
      SELECT 
        u.id as user_id,
        u.email,
        u.first_name,
        u.last_name,
        uta.id as assignment_id,
        t.id as tenant_id,
        t.tenant_id as tenant_identifier,
        t.seller_business_name,
        t.database_name,
        t.is_active
      FROM users u
      LEFT JOIN user_tenant_assignments uta ON u.id = uta.user_id
      LEFT JOIN tenants t ON uta.tenant_id = t.id
      WHERE u.email = 'asghar@gmail.com'
      ORDER BY u.id, t.seller_business_name
    `);

    console.log("\n=== USER COMPANY ASSIGNMENTS ===");
    if (userAssignments.length > 0) {
      console.table(userAssignments);

      // Count assignments
      const assignmentCount = userAssignments.filter(
        (row) => row.tenant_id !== null
      ).length;
      console.log(`\n📊 Total company assignments: ${assignmentCount}`);

      if (assignmentCount > 1) {
        console.log(
          '✅ User has multiple company assignments - should see "Select Company" in sidebar'
        );
      } else if (assignmentCount === 1) {
        console.log(
          "ℹ️  User has single company assignment - should auto-select company"
        );
      } else {
        console.log(
          "❌ User has no company assignments - this is the problem!"
        );
      }
    } else {
      console.log("❌ No user found or no company assignments");
    }

    // Also check all available tenants
    const [tenants] = await connection.execute(`
      SELECT 
        id,
        tenant_id,
        seller_business_name,
        database_name,
        is_active
      FROM tenants
      ORDER BY seller_business_name
    `);

    console.log("\n=== ALL AVAILABLE TENANTS ===");
    console.table(tenants);
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    if (connection) {
      await connection.end();
      console.log("Database connection closed");
    }
  }
}

checkUserCompanies();
