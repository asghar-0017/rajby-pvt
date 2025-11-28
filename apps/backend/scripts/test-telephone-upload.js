import mysql from "mysql2/promise";

// Database configuration
const dbConfig = {
  host: "157.245.150.54",
  port: 3307,
  user: "root",
  password: "root",
  multipleStatements: true,
};

async function testTelephoneUpload() {
  let connection;

  try {
    console.log("🧪 Testing telephone number upload simulation...");

    // Connect to MySQL
    connection = await mysql.createConnection(dbConfig);
    console.log("✅ Connected to MySQL database");

    // Get the hydra-foods database
    const [databases] = await connection.execute("SHOW DATABASES");
    const tenantDatabases = databases
      .filter((db) => {
        const dbName = Object.values(db)[0];
        return (
          dbName &&
          ![
            "information_schema",
            "performance_schema",
            "mysql",
            "sys",
          ].includes(dbName) &&
          !dbName.startsWith("test")
        );
      })
      .map((db) => Object.values(db)[0]);

    const dbName =
      tenantDatabases.find((db) => db === "hydra-foods") || tenantDatabases[0];
    console.log(`📊 Testing with database: ${dbName}`);

    // Switch to the tenant database
    await connection.query(`USE \`${dbName}\``);

    // Simulate the exact data structure that would come from frontend
    const testInvoiceData = {
      invoiceType: "Sale",
      invoiceDate: "2024-01-15",
      invoiceRefNo: "INV-001",
      companyInvoiceRefNo: "COMP-001",
      buyerNTNCNIC: "1234567890123",
      buyerBusinessName: "Test Buyer Company",
      buyerProvince: "PUNJAB",
      buyerAddress: "123 Test Street, Lahore",
      buyerRegistrationType: "Registered",
      buyerTelephone: "+92-300-1234567", // This should be saved
      transctypeId: "1",
      items: [
        {
          item_rate: "17",
          item_sroScheduleNo: "",
          item_sroItemSerialNo: "",
          item_saleType: "Goods at standard rate",
          item_hsCode: "1234.5678",
          item_uoM: "PCS",
          item_productName: "Test Product",
          item_productDescription: "Test Product Description",
          item_valueSalesExcludingST: "1000.00",
          item_quantity: "10",
          item_unitPrice: "100.00",
          item_salesTaxApplicable: "170.00",
          item_salesTaxWithheldAtSource: "0.00",
          item_extraTax: "0.00",
          item_furtherTax: "0.00",
          item_fedPayable: "0.00",
          item_discount: "0.00",
          item_totalValues: "1170.00",
        },
      ],
    };

    console.log("🔍 Test invoice data structure:", {
      buyerTelephone: testInvoiceData.buyerTelephone,
      hasBuyerTelephone: !!testInvoiceData.buyerTelephone,
      buyerBusinessName: testInvoiceData.buyerBusinessName,
    });

    // Test the exact same logic as in bulkCreateInvoices
    const invoiceRecord = {
      invoice_number: `TEST_TELEPHONE_${Date.now()}`,
      system_invoice_id: `TEST_${Date.now()}`,
      invoiceType: testInvoiceData.invoiceType,
      invoiceDate: testInvoiceData.invoiceDate,
      sellerNTNCNIC: "1234567890",
      sellerFullNTN: "1234567890",
      sellerBusinessName: "Test Seller",
      sellerProvince: "PUNJAB",
      sellerAddress: "Test Address",
      buyerNTNCNIC: testInvoiceData.buyerNTNCNIC,
      buyerBusinessName: testInvoiceData.buyerBusinessName,
      buyerProvince: testInvoiceData.buyerProvince,
      buyerAddress: testInvoiceData.buyerAddress,
      buyerRegistrationType: testInvoiceData.buyerRegistrationType,
      buyerTelephone: testInvoiceData.buyerTelephone, // This should be preserved
      invoiceRefNo: testInvoiceData.invoiceRefNo,
      companyInvoiceRefNo: testInvoiceData.companyInvoiceRefNo,
      internal_invoice_no: null,
      transctypeId: testInvoiceData.transctypeId,
      status: "draft",
      fbr_invoice_number: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    console.log("🔍 Invoice record before insertion:", {
      buyerTelephone: invoiceRecord.buyerTelephone,
      hasBuyerTelephone: !!invoiceRecord.buyerTelephone,
      buyerBusinessName: invoiceRecord.buyerBusinessName,
    });

    // Insert the test invoice
    const [result] = await connection.query(
      `
      INSERT INTO invoices (
        invoice_number, system_invoice_id, invoiceType, invoiceDate,
        sellerNTNCNIC, sellerFullNTN, sellerBusinessName, sellerProvince, sellerAddress,
        buyerNTNCNIC, buyerBusinessName, buyerProvince, buyerAddress, buyerRegistrationType,
        buyerTelephone, invoiceRefNo, companyInvoiceRefNo, internal_invoice_no,
        transctypeId, status, fbr_invoice_number, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        invoiceRecord.invoice_number,
        invoiceRecord.system_invoice_id,
        invoiceRecord.invoiceType,
        invoiceRecord.invoiceDate,
        invoiceRecord.sellerNTNCNIC,
        invoiceRecord.sellerFullNTN,
        invoiceRecord.sellerBusinessName,
        invoiceRecord.sellerProvince,
        invoiceRecord.sellerAddress,
        invoiceRecord.buyerNTNCNIC,
        invoiceRecord.buyerBusinessName,
        invoiceRecord.buyerProvince,
        invoiceRecord.buyerAddress,
        invoiceRecord.buyerRegistrationType,
        invoiceRecord.buyerTelephone,
        invoiceRecord.invoiceRefNo,
        invoiceRecord.companyInvoiceRefNo,
        invoiceRecord.internal_invoice_no,
        invoiceRecord.transctypeId,
        invoiceRecord.status,
        invoiceRecord.fbr_invoice_number,
        invoiceRecord.created_at,
        invoiceRecord.updated_at,
      ]
    );

    console.log(
      "✅ Test invoice inserted successfully with ID:",
      result.insertId
    );

    // Verify the inserted data
    const [insertedInvoice] = await connection.query(`
      SELECT id, invoice_number, buyerBusinessName, buyerTelephone, created_at
      FROM invoices 
      WHERE id = ${result.insertId}
    `);

    if (insertedInvoice.length > 0) {
      const invoice = insertedInvoice[0];
      console.log("✅ Verification successful:");
      console.log(`  - Invoice: ${invoice.invoice_number}`);
      console.log(`  - Buyer: ${invoice.buyerBusinessName}`);
      console.log(`  - Telephone: ${invoice.buyerTelephone}`);
      console.log(`  - Created: ${invoice.created_at}`);

      if (invoice.buyerTelephone === "+92-300-1234567") {
        console.log("🎉 SUCCESS: Telephone number was saved correctly!");
      } else {
        console.log("❌ FAILURE: Telephone number was not saved correctly!");
        console.log(
          `Expected: +92-300-1234567, Got: ${invoice.buyerTelephone}`
        );
      }
    }

    // Clean up test data
    await connection.query(
      `DELETE FROM invoices WHERE id = ${result.insertId}`
    );
    console.log("🧹 Test data cleaned up");

    console.log("\n🎉 Test completed!");
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    if (connection) {
      await connection.end();
      console.log("🔌 Database connection closed");
    }
  }
}

// Run the test
testTelephoneUpload().catch(console.error);
