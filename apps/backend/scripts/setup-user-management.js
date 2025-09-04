import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { masterSequelize } from "../src/config/mysql.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function setupUserManagement() {
  try {
    console.log("🚀 Setting up User Management System...");

    // Read the SQL file
    const sqlPath = path.join(__dirname, "create-user-management-tables.sql");
    const sqlContent = fs.readFileSync(sqlPath, "utf8");

    // Split the SQL content into individual statements
    const statements = sqlContent
      .split(";")
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0);

    // Execute each statement
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        await masterSequelize.query(statement);
      }
    }

    console.log("✅ User Management tables created successfully!");
    console.log("📋 Tables created:");
    console.log("   - users");
    console.log("   - user_tenant_assignments");

    console.log("\n🎉 User Management System setup complete!");
    console.log("\nNext steps:");
    console.log("1. Restart your backend server");
    console.log("2. Access User Management from admin panel");
    console.log("3. Create users and assign them to companies");
  } catch (error) {
    console.error("❌ Error setting up User Management System:", error);
    process.exit(1);
  } finally {
    await masterSequelize.close();
  }
}

// Run the setup
setupUserManagement();
