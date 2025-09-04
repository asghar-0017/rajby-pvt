import { masterSequelize } from "../src/config/mysql.js";
import TenantDatabaseService from "../src/service/TenantDatabaseService.js";
import UserManagementService from "../src/service/UserManagementService.js";

async function testAdminEndpoints() {
  try {
    console.log("🔍 Testing admin endpoints for boolean conversion...");

    // Test TenantDatabaseService.getAllTenants()
    console.log("\n📋 Testing TenantDatabaseService.getAllTenants():");
    const tenantDbTenants = await TenantDatabaseService.getAllTenants();
    tenantDbTenants.forEach((tenant, index) => {
      console.log(
        `${index + 1}. ${tenant.sellerBusinessName} - is_active: ${tenant.is_active} (Type: ${typeof tenant.is_active})`
      );
    });

    // Test UserManagementService.getAllTenants()
    console.log("\n📋 Testing UserManagementService.getAllTenants():");
    const userMgmtTenants = await UserManagementService.getAllTenants();
    userMgmtTenants.forEach((tenant, index) => {
      console.log(
        `${index + 1}. ${tenant.sellerBusinessName} - is_active: ${tenant.is_active} (Type: ${typeof tenant.is_active})`
      );
    });

    // Test frontend logic
    console.log("\n🎯 Testing frontend logic:");
    const allTenants = [...tenantDbTenants, ...userMgmtTenants];
    allTenants.forEach((tenant, index) => {
      const status = tenant.is_active ? "Active" : "Inactive";
      const buttonDisabled = !tenant.is_active;
      console.log(
        `${index + 1}. ${tenant.sellerBusinessName} - Status: ${status}, Button Disabled: ${buttonDisabled}`
      );
    });

    await masterSequelize.close();
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

testAdminEndpoints();
