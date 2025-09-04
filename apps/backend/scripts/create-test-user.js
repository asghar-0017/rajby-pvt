import bcrypt from "bcryptjs";
import { masterSequelize } from "../src/config/mysql.js";
import User from "../src/model/mysql/User.js";
import UserTenantAssignment from "../src/model/mysql/UserTenantAssignment.js";
import Tenant from "../src/model/mysql/Tenant.js";

async function createTestUser() {
  try {
    console.log("🚀 Creating test user...");

    // First, let's get the first available tenant
    const tenant = await Tenant.findOne({
      where: { is_active: true },
      order: [["id", "ASC"]],
    });

    if (!tenant) {
      console.log("❌ No active tenants found. Please create a tenant first.");
      return;
    }

    console.log(`📋 Using tenant: ${tenant.seller_business_name}`);

    // Check if test user already exists
    const existingUser = await User.findOne({
      where: { email: "test@example.com" },
    });

    if (existingUser) {
      console.log("✅ Test user already exists!");
      console.log(`📧 Email: test@example.com`);
      console.log(`🔑 Password: testpassword123`);
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash("testpassword123", 12);

    // Create test user
    const user = await User.create({
      email: "test@example.com",
      password: hashedPassword,
      firstName: "Test",
      lastName: "User",
      phone: "+1234567890",
      role: "user",
      isActive: true,
      isVerified: true,
      createdBy: 1, // Assuming admin user with ID 1 exists
    });

    console.log("✅ Test user created successfully!");

    // Assign user to the tenant
    await UserTenantAssignment.create({
      userId: user.id,
      tenantId: tenant.id,
      assignedBy: 1, // Assuming admin user with ID 1 exists
      isActive: true,
    });

    console.log(`✅ User assigned to tenant: ${tenant.seller_business_name}`);

    console.log("\n🎉 Test user setup complete!");
    console.log("\n📋 Login credentials:");
    console.log(`📧 Email: test@example.com`);
    console.log(`🔑 Password: testpassword123`);
    console.log(`🏢 Company: ${tenant.seller_business_name}`);
  } catch (error) {
    console.error("❌ Error creating test user:", error);
  } finally {
    await masterSequelize.close();
  }
}

// Run the script
createTestUser();
