import mysql from "mysql2/promise";

// Database configuration
const dbConfig = {
  host: "localhost",
  port: 3307,
  user: "root",
  password: "root",
  multipleStatements: true,
};

async function testTelephoneSave() {
  let connection;

  try {
    console.log("🧪 Testing telephone number saving functionality...");

    // Connect to MySQL
    connection = await mysql.createConnection(dbConfig);
    console.log("✅ Connected to MySQL database");

    // Get the tenant database
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

    if (tenantDatabases.length === 0) {
      console.log("❌ No tenant databases found");
      return;
    }

    const dbName = tenantDatabases[0]; // Use the first tenant database
    console.log(`📊 Testing with database: ${dbName}`);

    // Switch to the tenant database
    await connection.query(`USE \`${dbName}\``);

    // Check if buyerTelephone column exists
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = '${dbName}' 
      AND TABLE_NAME = 'invoices' 
      AND COLUMN_NAME = 'buyerTelephone'
    `);

    if (columns.length === 0) {
      console.log("❌ buyerTelephone column not found in invoices table");
      return;
    }

    console.log("✅ buyerTelephone column found:", columns[0]);

    // Check if there are any existing invoices with telephone numbers
    const [invoices] = await connection.query(`
      SELECT id, invoice_number, buyerBusinessName, buyerTelephone 
      FROM invoices 
      WHERE buyerTelephone IS NOT NULL 
      LIMIT 5
    `);

    if (invoices.length > 0) {
      console.log("📞 Found invoices with telephone numbers:");
      invoices.forEach((invoice) => {
        console.log(
          `  - Invoice ${invoice.invoice_number}: ${invoice.buyerBusinessName} - ${invoice.buyerTelephone}`
        );
      });
    } else {
      console.log("ℹ️  No invoices with telephone numbers found yet");
    }

    // Test inserting a sample invoice with telephone number
    console.log("\n🧪 Testing insertion of invoice with telephone number...");

    const testInvoice = {
      invoice_number: `TEST_TELEPHONE_${Date.now()}`,
      system_invoice_id: `TEST_${Date.now()}`,
      invoiceType: "Test",
      invoiceDate: "2024-01-01",
      sellerNTNCNIC: "1234567890",
      sellerBusinessName: "Test Seller",
      sellerProvince: "PUNJAB",
      buyerNTNCNIC: "0987654321",
      buyerBusinessName: "Test Buyer",
      buyerProvince: "PUNJAB",
      buyerRegistrationType: "Registered",
      buyerTelephone: "+92-300-1234567",
      status: "draft",
      created_at: new Date(),
      updated_at: new Date(),
    };

    const [result] = await connection.query(
      `
      INSERT INTO invoices (
        invoice_number, system_invoice_id, invoiceType, invoiceDate,
        sellerNTNCNIC, sellerBusinessName, sellerProvince,
        buyerNTNCNIC, buyerBusinessName, buyerProvince, buyerRegistrationType,
        buyerTelephone, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        testInvoice.invoice_number,
        testInvoice.system_invoice_id,
        testInvoice.invoiceType,
        testInvoice.invoiceDate,
        testInvoice.sellerNTNCNIC,
        testInvoice.sellerBusinessName,
        testInvoice.sellerProvince,
        testInvoice.buyerNTNCNIC,
        testInvoice.buyerBusinessName,
        testInvoice.buyerProvince,
        testInvoice.buyerRegistrationType,
        testInvoice.buyerTelephone,
        testInvoice.status,
        testInvoice.created_at,
        testInvoice.updated_at,
      ]
    );

    console.log(
      "✅ Test invoice inserted successfully with ID:",
      result.insertId
    );

    // Verify the inserted data
    const [insertedInvoice] = await connection.query(`
      SELECT id, invoice_number, buyerBusinessName, buyerTelephone 
      FROM invoices 
      WHERE id = ${result.insertId}
    `);

    if (insertedInvoice.length > 0) {
      const invoice = insertedInvoice[0];
      console.log("✅ Verification successful:");
      console.log(`  - Invoice: ${invoice.invoice_number}`);
      console.log(`  - Buyer: ${invoice.buyerBusinessName}`);
      console.log(`  - Telephone: ${invoice.buyerTelephone}`);
    }

    // Clean up test data
    await connection.query(
      `DELETE FROM invoices WHERE id = ${result.insertId}`
    );
    console.log("🧹 Test data cleaned up");

    console.log(
      "\n🎉 Telephone number saving functionality is working correctly!"
    );
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
testTelephoneSave().catch(console.error);
