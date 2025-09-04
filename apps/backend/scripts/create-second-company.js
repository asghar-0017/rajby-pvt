import { masterSequelize } from "../src/config/mysql.js";
import Tenant from "../src/model/mysql/Tenant.js";

async function createSecondCompany() {
  try {
    console.log("🚀 Creating second company for testing...");

    // Check if second company already exists
    const existingCompany = await Tenant.findOne({
      where: { seller_business_name: "TEST COMPANY" },
    });

    if (existingCompany) {
      console.log("✅ Second company already exists!");
      console.log(
        `🏢 Company: ${existingCompany.seller_business_name} (ID: ${existingCompany.id})`
      );
      return;
    }

    // Create second company
    const newCompany = await Tenant.create({
      tenant_id: `tenant_${Date.now()}_testcompany`,
      seller_ntn_cnic: "1234567890123",
      seller_full_ntn: "1234567890123",
      seller_business_name: "TEST COMPANY",
      seller_province: "PUNJAB",
      seller_address: "Test Address, Test City",
      database_name: "test_company_db",
      sandboxTestToken: "test-token-123",
      sandboxProductionToken: "test-token-123",
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    });

    console.log("✅ Second company created successfully!");
    console.log(
      `🏢 Company: ${newCompany.seller_business_name} (ID: ${newCompany.id})`
    );
  } catch (error) {
    console.error("❌ Error creating second company:", error);
  } finally {
    await masterSequelize.close();
  }
}

// Run the script
createSecondCompany();
