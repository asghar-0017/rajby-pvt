const axios = require("axios");

// Test data for buyer upload
const testBuyers = [
  {
    buyerNTNCNIC: "1234567890123",
    buyerBusinessName: "Test Company 1",
    buyerProvince: "PUNJAB",
    buyerAddress: "123 Test Street Lahore",
    buyerRegistrationType: "Registered",
  },
  {
    buyerNTNCNIC: "9876543210987",
    buyerBusinessName: "Test Company 2",
    buyerProvince: "SINDH",
    buyerAddress: "456 Test Avenue Karachi",
    buyerRegistrationType: "Unregistered",
  },
  {
    buyerNTNCNIC: "4567891230456",
    buyerBusinessName: "Test Company 3",
    buyerProvince: "KHYBER PAKHTUNKHWA",
    buyerAddress: "789 Test Road Peshawar",
    buyerRegistrationType: "Registered",
  },
];

async function testCheckExistingBuyers() {
  try {
    console.log("Testing check existing buyers endpoint...");

    // You'll need to replace these with actual values from your system
    const tenantId = "your-tenant-id"; // Replace with actual tenant ID
    const token = "your-auth-token"; // Replace with actual auth token

    const response = await axios.post(
      `https://united-tubes.inplsoftwares.online/api/tenant/${tenantId}/buyers/check-existing`,
      { buyers: testBuyers },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Check existing response:", response.data);

    const { existing, new: newBuyers, summary } = response.data.data;
    console.log(
      `Summary: ${summary.total} total, ${summary.existing} existing, ${summary.new} new`
    );

    if (existing.length > 0) {
      console.log("Existing buyers:");
      existing.forEach((item) => {
        console.log(
          `  Row ${item.row}: ${item.buyerData.buyerNTNCNIC} - ${item.buyerData.buyerBusinessName} (Already exists as: ${item.existingBuyer.buyerBusinessName})`
        );
      });
    }

    if (newBuyers.length > 0) {
      console.log("New buyers:");
      newBuyers.forEach((item) => {
        console.log(
          `  Row ${item.row}: ${item.buyerData.buyerNTNCNIC} - ${item.buyerData.buyerBusinessName}`
        );
      });
    }
  } catch (error) {
    console.error(
      "Check existing failed:",
      error.response?.data || error.message
    );
  }
}

async function testBuyerUpload() {
  try {
    console.log("Testing buyer upload...");

    // You'll need to replace these with actual values from your system
    const tenantId = "your-tenant-id"; // Replace with actual tenant ID
    const token = "your-auth-token"; // Replace with actual auth token

    const response = await axios.post(
      `https://united-tubes.inplsoftwares.online/api/tenant/${tenantId}/buyers/bulk`,
      { buyers: testBuyers },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Upload successful:", response.data);
  } catch (error) {
    console.error("Upload failed:", error.response?.data || error.message);
  }
}

// Run the tests
console.log("=== Testing Check Existing Buyers ===");
testCheckExistingBuyers()
  .then(() => {
    console.log("\n=== Testing Buyer Upload ===");
    return testBuyerUpload();
  })
  .catch((error) => {
    console.error("Test error:", error);
  });
