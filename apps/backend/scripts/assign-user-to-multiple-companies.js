import { masterSequelize } from "../src/config/mysql.js";
import User from "../src/model/mysql/User.js";
import UserTenantAssignment from "../src/model/mysql/UserTenantAssignment.js";
import Tenant from "../src/model/mysql/Tenant.js";

async function assignUserToMultipleCompanies() {
  try {
    console.log("🚀 Assigning test user to multiple companies...");

    // Get the test user
    const user = await User.findOne({
      where: { email: "test@example.com" },
    });

    if (!user) {
      console.log("❌ Test user not found. Please create the test user first.");
      return;
    }

    console.log(
      `👤 Found user: ${user.firstName} ${user.lastName} (${user.email})`
    );

    // Get all active tenants
    const tenants = await Tenant.findAll({
      where: { is_active: true },
      order: [["id", "ASC"]],
      limit: 3, // Assign to first 3 companies
    });

    if (tenants.length < 2) {
      console.log(
        "❌ Need at least 2 companies to demonstrate multiple company assignment."
      );
      return;
    }

    console.log(`📋 Found ${tenants.length} companies:`);
    tenants.forEach((tenant) => {
      console.log(`   - ${tenant.seller_business_name}`);
    });

    // Remove existing assignments
    await UserTenantAssignment.destroy({
      where: { userId: user.id },
    });

    console.log("🗑️ Removed existing company assignments");

    // Assign user to multiple companies
    for (const tenant of tenants) {
      await UserTenantAssignment.create({
        userId: user.id,
        tenantId: tenant.id,
        assignedBy: 1, // Assuming admin user with ID 1 exists
        isActive: true,
      });
      console.log(`✅ Assigned to: ${tenant.seller_business_name}`);
    }

    console.log("\n🎉 User successfully assigned to multiple companies!");
    console.log("\n📋 Test credentials:");
    console.log(`📧 Email: test@example.com`);
    console.log(`🔑 Password: testpassword123`);
    console.log(
      `🏢 Companies: ${tenants.map((t) => t.seller_business_name).join(", ")}`
    );
  } catch (error) {
    console.error("❌ Error assigning user to multiple companies:", error);
  } finally {
    await masterSequelize.close();
  }
}

// Run the script
assignUserToMultipleCompanies();
