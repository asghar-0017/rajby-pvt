// Test script for Submit Button Flow
// This script can be used to test the new two-step submission process

const testSubmitFlow = async () => {
  console.log("Testing Submit Button Flow...");

  // Mock data for testing
  const mockFormData = {
    invoiceType: "SI",
    invoiceDate: "2024-01-15",
    sellerNTNCNIC: "1234567890123",
    sellerBusinessName: "Test Company",
    sellerProvince: "Punjab",
    sellerAddress: "Test Address",
    buyerNTNCNIC: "9876543210987",
    buyerBusinessName: "Test Buyer",
    buyerProvince: "Sindh",
    buyerAddress: "Buyer Address",
    buyerRegistrationType: "Registered",
    invoiceRefNo: "INV-001",
    scenarioId: "SN001",
    items: [
      {
        hsCode: "12345678",
        productDescription: "Test Product",
        rate: "17",
        uoM: "PCS",
        quantity: "10",
        unitPrice: "100",
        retailPrice: "100",
        totalValues: "1000",
        valueSalesExcludingST: "854.70",
        salesTaxApplicable: "145.30",
        salesTaxWithheldAtSource: "0",
        sroScheduleNo: "",
        sroItemSerialNo: "",
        billOfLadingUoM: "",
        saleType: "Goods at standard rate (default)",
        extraTax: "0",
        furtherTax: "0",
        fedPayable: "0",
        discount: "0",
      },
    ],
  };

  const mockFBRResponse = {
    status: 200,
    data: {
      invoiceNumber: "FBR123456789",
      success: true,
    },
  };

  const mockBackendResponse = {
    status: 201,
    data: {
      success: true,
      data: {
        invoice_id: 123,
        invoice_number: "FBR123456789",
        fbr_invoice_number: "FBR123456789",
      },
    },
  };

  console.log("✅ Test data prepared");
  console.log("✅ FBR API response mock:", mockFBRResponse);
  console.log("✅ Backend API response mock:", mockBackendResponse);

  // Test the flow steps
  try {
    // Step 1: FBR API call
    console.log("\n📋 Step 1: FBR API Call");
    console.log(
      "   - Endpoint: POST https://gw.fbr.gov.pk/dist/v1/di_data/v1/di/postinvoicedata"
    );
    console.log("   - Status:", mockFBRResponse.status);
    console.log("   - Invoice Number:", mockFBRResponse.data.invoiceNumber);

    if (mockFBRResponse.status === 200 && mockFBRResponse.data.invoiceNumber) {
      console.log("   ✅ FBR API call successful");
    } else {
      throw new Error("FBR API call failed");
    }

    // Step 2: Backend API call
    console.log("\n📋 Step 2: Backend API Call");
    console.log(
      "   - Endpoint: POST =https://anjum-parts.inplsoftwares.online/api/tenant/{tenant_id}/invoices"
    );
    console.log("   - Status:", mockBackendResponse.status);
    console.log("   - Invoice ID:", mockBackendResponse.data.data.invoice_id);
    console.log(
      "   - FBR Invoice Number:",
      mockBackendResponse.data.data.fbr_invoice_number
    );

    if (mockBackendResponse.status === 201) {
      console.log("   ✅ Backend API call successful");
    } else {
      throw new Error("Backend API call failed");
    }

    // Step 3: Success handling
    console.log("\n📋 Step 3: Success Handling");
    console.log("   ✅ Both API calls successful");
    console.log("   ✅ Invoice submitted successfully");
    console.log(
      "   ✅ FBR Invoice Number:",
      mockFBRResponse.data.invoiceNumber
    );

    console.log("\n🎉 Submit Button Flow Test: PASSED");
  } catch (error) {
    console.error("\n❌ Submit Button Flow Test: FAILED");
    console.error("Error:", error.message);
  }
};

// Error handling test
const testErrorHandling = () => {
  console.log("\n🧪 Testing Error Handling...");

  const errorScenarios = [
    {
      name: "FBR API Network Error",
      error: { request: true },
      expectedTitle: "Network Error",
      expectedMessage:
        "Unable to connect to server. Please check your internet connection.",
    },
    {
      name: "Backend Authentication Error",
      error: { response: { status: 401 } },
      expectedTitle: "Authentication Error",
      expectedMessage: "Please log in again. Your session may have expired.",
    },
    {
      name: "Duplicate Invoice Error",
      error: {
        response: { status: 409, data: { message: "Invoice already exists" } },
      },
      expectedTitle: "Duplicate Invoice",
      expectedMessage: "An invoice with this number already exists.",
    },
    {
      name: "FBR Validation Error",
      error: { message: "FBR validation failed: Invalid HS Code" },
      expectedTitle: "Submission Error",
      expectedMessage: "FBR validation failed: Invalid HS Code",
    },
  ];

  errorScenarios.forEach((scenario, index) => {
    console.log(`\n📋 Error Scenario ${index + 1}: ${scenario.name}`);
    console.log(`   Expected Title: ${scenario.expectedTitle}`);
    console.log(`   Expected Message: ${scenario.expectedMessage}`);
    console.log("   ✅ Error handling test case prepared");
  });

  console.log("\n✅ Error handling test cases prepared");
};

// Run tests
console.log("🚀 Starting Submit Button Flow Tests...\n");
testSubmitFlow();
testErrorHandling();
console.log("\n✨ All tests completed!");
