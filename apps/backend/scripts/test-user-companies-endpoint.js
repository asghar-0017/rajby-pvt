import { masterSequelize } from "../src/config/mysql.js";
import UserManagementService from "../src/service/UserManagementService.js";

async function testUserCompaniesEndpoint() {
  try {
    console.log("🔍 Testing user companies endpoint logic...");

    // Simulate what the endpoint does
    const userId = 3; // The user we know exists
    const user = await UserManagementService.getUserById(userId);

    console.log("👤 User found:", {
      id: user.id,
      email: user.email,
      isActive: user.isActive,
    });

    console.log(
      "📋 User tenant assignments:",
      user.UserTenantAssignments?.length || 0
    );

    if (user.UserTenantAssignments && user.UserTenantAssignments.length > 0) {
      user.UserTenantAssignments.forEach((assignment, index) => {
        console.log(`\n📋 Assignment ${index + 1}:`);
        console.log(
          "  - Assignment Active:",
          assignment.isActive,
          "Type:",
          typeof assignment.isActive
        );
        console.log("  - Tenant ID:", assignment.Tenant.id);
        console.log("  - Tenant Name:", assignment.Tenant.seller_business_name);
        console.log(
          "  - Tenant is_active (raw):",
          assignment.Tenant.is_active,
          "Type:",
          typeof assignment.Tenant.is_active
        );

        // Test the Boolean conversion
        const convertedIsActive = Boolean(assignment.Tenant.is_active);
        console.log(
          "  - Converted is_active:",
          convertedIsActive,
          "Type:",
          typeof convertedIsActive
        );

        // Test the frontend logic
        console.log(
          "  - Frontend status:",
          convertedIsActive ? "Active" : "Inactive"
        );
        console.log("  - Button disabled:", !convertedIsActive);
      });

      // Format the companies as the endpoint does
      const assignedCompanies = user.UserTenantAssignments.map(
        (assignment) => ({
          id: assignment.Tenant.id,
          tenant_id: assignment.Tenant.tenant_id,
          sellerNTNCNIC: assignment.Tenant.seller_ntn_cnic,
          sellerBusinessName: assignment.Tenant.seller_business_name,
          sellerProvince: assignment.Tenant.seller_province,
          sellerAddress: assignment.Tenant.seller_address,
          is_active: Boolean(assignment.Tenant.is_active),
          database_name: assignment.Tenant.database_name,
          created_at: assignment.Tenant.created_at,
          sandboxTestToken: assignment.Tenant.sandbox_test_token,
          sandboxProductionToken: assignment.Tenant.sandbox_production_token,
        })
      );

      console.log("\n🎯 Final formatted companies:");
      assignedCompanies.forEach((company, index) => {
        console.log(`\n🏢 Company ${index + 1}:`);
        console.log("  - Name:", company.sellerBusinessName);
        console.log(
          "  - is_active:",
          company.is_active,
          "Type:",
          typeof company.is_active
        );
        console.log(
          "  - Frontend status:",
          company.is_active ? "Active" : "Inactive"
        );
        console.log("  - Button disabled:", !company.is_active);
      });
    } else {
      console.log("❌ No tenant assignments found");
    }

    await masterSequelize.close();
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

testUserCompaniesEndpoint();
