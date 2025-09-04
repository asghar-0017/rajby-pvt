import { masterSequelize } from "../src/config/mysql.js";

async function checkAssignments() {
  try {
    console.log("🔍 Checking user-tenant assignments...");

    // Check user_tenant_assignments table
    const [assignments] = await masterSequelize.query(
      "SELECT * FROM user_tenant_assignments"
    );

    console.log(
      `📋 Found ${assignments.length} assignments in user_tenant_assignments table:`
    );
    assignments.forEach((assignment, index) => {
      console.log(
        `${index + 1}. User ID: ${assignment.user_id}, Tenant ID: ${assignment.tenant_id}, Active: ${assignment.is_active}`
      );
    });

    // Check tenants table
    const [tenants] = await masterSequelize.query("SELECT * FROM tenants");

    console.log(`\n🏢 Found ${tenants.length} tenants in tenants table:`);
    tenants.forEach((tenant, index) => {
      console.log(
        `${index + 1}. ID: ${tenant.id}, Name: ${tenant.seller_business_name}, Active: ${tenant.is_active}`
      );
    });

    // Check users table
    const [users] = await masterSequelize.query("SELECT * FROM users");

    console.log(`\n👤 Found ${users.length} users in users table:`);
    users.forEach((user, index) => {
      console.log(
        `${index + 1}. ID: ${user.id}, Email: ${user.email}, Active: ${user.is_active}`
      );
    });

    await masterSequelize.close();
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

checkAssignments();
