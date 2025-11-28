// Test script to verify login and permission system
import fetch from "node-fetch";

const API_BASE = "http://157.245.150.54:5000/api";

async function testLogin(email, password, userType) {
  try {
    console.log(`\n=== Testing ${userType} Login: ${email} ===`);

    const response = await fetch(`${API_BASE}/user-auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (data.success && data.data.token) {
      console.log("✓ Login successful");
      console.log("User data:", {
        id: data.data.user.id,
        email: data.data.user.email,
        role: data.data.user.role,
        roleId: data.data.user.roleId,
        userRole: data.data.user.userRole,
      });

      const token = data.data.token;

      // Test fetching permissions
      console.log("Testing permission fetch...");
      const permResponse = await fetch(`${API_BASE}/user-auth/my-permissions`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const permData = await permResponse.json();

      if (permData.success) {
        console.log("✓ Permissions fetched successfully");
        console.log(
          "Permissions:",
          permData.data.map((p) => p.name)
        );
      } else {
        console.log("✗ Failed to fetch permissions:", permData.message);
      }
    } else {
      console.log("✗ Login failed:", data.message);
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
}

async function runTests() {
  console.log("Testing FBR Login and Permission System");
  console.log("=====================================");

  // Test admin user
  await testLogin("asghar@gmail.com", "password123", "Admin");

  // Test buyer user
  await testLogin("test@example.com", "password123", "Buyer");

  // Test regular user
  await testLogin("daniyal@gmail.com", "password123", "Regular User");
}

runTests();
