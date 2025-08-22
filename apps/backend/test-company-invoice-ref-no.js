#!/usr/bin/env node

/**
 * Test Script: Test companyInvoiceRefNo Field
 *
 * This script tests that the companyInvoiceRefNo field is properly
 * saved to the database when creating an invoice.
 */

import axios from "axios";

const BASE_URL = "https://adnan-textile.inplsoftwares.online";

async function testCompanyInvoiceRefNo() {
  try {
    console.log("🧪 Testing companyInvoiceRefNo field...");

    // Test data with companyInvoiceRefNo
    const testInvoiceData = {
      invoiceType: "Sale Invoice",
      invoiceDate: "2024-01-15",
      sellerNTNCNIC: "4136940",
      sellerBusinessName: "Hydra Foods",
      sellerProvince: "SINDH",
      sellerAddress: "Karachi",
      buyerNTNCNIC: "123456789",
      buyerBusinessName: "Test Buyer",
      buyerProvince: "SINDH",
      buyerAddress: "Test Address",
      buyerRegistrationType: "Registered",
      invoiceRefNo: "INV-001",
      companyInvoiceRefNo: "COMP-REF-001", // This is the field we're testing
      transctypeId: "1",
      items: [
        {
          hsCode: "123456",
          productDescription: "Test Product",
          rate: "15",
          uoM: "PCS",
          quantity: "10",
          unitPrice: "100.00",
          totalValues: "1000.00",
          valueSalesExcludingST: "1000.00",
          salesTaxApplicable: "150.00",
          salesTaxWithheldAtSource: "0",
          furtherTax: "0",
          sroScheduleNo: "",
          fedPayable: "0",
          discount: "0",
          saleType: "Local",
          sroItemSerialNo: "",
          billOfLadingUoM: "",
        },
      ],
    };

    console.log("📤 Sending test invoice data...");
    console.log("Company Invoice Ref No:", testInvoiceData.companyInvoiceRefNo);

    // Make API call to create invoice
    const response = await axios.post(
      `${BASE_URL}/tenant/tenant_1754922894954_5m7vghp4d/invoices`,
      testInvoiceData,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Invoice created successfully!");
    console.log("Response:", JSON.stringify(response.data, null, 2));

    // Verify the companyInvoiceRefNo was saved
    if (response.data.success && response.data.data) {
      console.log("🔍 Verifying companyInvoiceRefNo was saved...");

      // Get the created invoice to verify the field was saved
      const invoiceId = response.data.data.invoice_id;
      const getResponse = await axios.get(
        `${BASE_URL}/tenant/tenant_1754922894954_5m7vghp4d/invoices/${invoiceId}`
      );

      if (getResponse.data.success && getResponse.data.data) {
        const savedInvoice = getResponse.data.data;
        console.log("📋 Retrieved invoice data:");
        console.log(
          "Company Invoice Ref No:",
          savedInvoice.companyInvoiceRefNo
        );

        if (
          savedInvoice.companyInvoiceRefNo ===
          testInvoiceData.companyInvoiceRefNo
        ) {
          console.log(
            "✅ SUCCESS: companyInvoiceRefNo field is working correctly!"
          );
        } else {
          console.log(
            "❌ FAILED: companyInvoiceRefNo field was not saved correctly"
          );
          console.log("Expected:", testInvoiceData.companyInvoiceRefNo);
          console.log("Actual:", savedInvoice.companyInvoiceRefNo);
        }
      } else {
        console.log("❌ Failed to retrieve invoice for verification");
      }
    }
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
    }
  }
}

// Run the test
testCompanyInvoiceRefNo();
