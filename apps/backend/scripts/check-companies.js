import { masterSequelize } from "../src/config/mysql.js";
import Tenant from "../src/model/mysql/Tenant.js";

async function checkCompanies() {
  try {
    console.log("🔍 Checking available companies...");

    const tenants = await Tenant.findAll({
      order: [["id", "ASC"]],
    });

    console.log(`📋 Found ${tenants.length} companies:`);
    tenants.forEach((tenant, index) => {
      console.log(
        `${index + 1}. ${tenant.seller_business_name} (ID: ${tenant.id}, Active: ${tenant.is_active})`
      );
    });

    const activeTenants = tenants.filter((t) => t.is_active);
    console.log(`\n✅ Active companies: ${activeTenants.length}`);
  } catch (error) {
    console.error("❌ Error checking companies:", error);
  } finally {
    await masterSequelize.close();
  }
}

// Run the script
checkCompanies();
