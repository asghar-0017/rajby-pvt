import { masterSequelize } from "../src/config/mysql.js";
import Tenant from "../src/model/mysql/Tenant.js";

async function checkTenantStructure() {
  try {
    console.log("🔍 Checking tenant structure...");

    const tenant = await Tenant.findOne({
      where: { id: 1 },
    });

    if (tenant) {
      console.log("📋 Existing tenant structure:");
      console.log(JSON.stringify(tenant.dataValues, null, 2));
    } else {
      console.log("❌ No tenant found");
    }
  } catch (error) {
    console.error("❌ Error checking tenant structure:", error);
  } finally {
    await masterSequelize.close();
  }
}

// Run the script
checkTenantStructure();
