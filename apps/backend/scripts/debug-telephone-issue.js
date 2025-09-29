import mysql from "mysql2/promise";

// Database configuration
const dbConfig = {
  host: "localhost",
  port: 3307,
  user: "root",
  password: "root",
  multipleStatements: true,
};

async function debugTelephoneIssue() {
  let connection;

  try {
    console.log("🔍 Debugging telephone number issue...");

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

    // Find the hydra-foods database specifically
    const dbName =
      tenantDatabases.find((db) => db === "hydra-foods") || tenantDatabases[0];
    console.log(`📊 Checking database: ${dbName}`);

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

    // Check recent invoices
    const [recentInvoices] = await connection.query(`
      SELECT id, invoice_number, buyerBusinessName, buyerTelephone, created_at
      FROM invoices 
      ORDER BY created_at DESC 
      LIMIT 10
    `);

    console.log("\n📞 Recent invoices:");
    recentInvoices.forEach((invoice, index) => {
      console.log(`${index + 1}. Invoice ${invoice.invoice_number}:`);
      console.log(`   - Buyer: ${invoice.buyerBusinessName}`);
      console.log(`   - Telephone: ${invoice.buyerTelephone || "NULL"}`);
      console.log(`   - Created: ${invoice.created_at}`);
      console.log("");
    });

    // Check if there are any invoices with telephone numbers
    const [invoicesWithTelephone] = await connection.query(`
      SELECT COUNT(*) as count
      FROM invoices 
      WHERE buyerTelephone IS NOT NULL AND buyerTelephone != ''
    `);

    console.log(
      `📊 Invoices with telephone numbers: ${invoicesWithTelephone[0].count}`
    );

    // Check if there are any invoices without telephone numbers
    const [invoicesWithoutTelephone] = await connection.query(`
      SELECT COUNT(*) as count
      FROM invoices 
      WHERE buyerTelephone IS NULL OR buyerTelephone = ''
    `);

    console.log(
      `📊 Invoices without telephone numbers: ${invoicesWithoutTelephone[0].count}`
    );

    // Test inserting a sample invoice with telephone number
    console.log("\n🧪 Testing insertion of invoice with telephone number...");

    const testInvoice = {
      invoice_number: `DEBUG_TELEPHONE_${Date.now()}`,
      system_invoice_id: `DEBUG_${Date.now()}`,
      invoiceType: "Test",
      invoiceDate: "2024-01-01",
      sellerNTNCNIC: "1234567890",
      sellerBusinessName: "Debug Seller",
      sellerProvince: "PUNJAB",
      buyerNTNCNIC: "0987654321",
      buyerBusinessName: "Debug Buyer",
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

    console.log("\n🎉 Debug completed successfully!");
  } catch (error) {
    console.error("❌ Debug failed:", error);
  } finally {
    if (connection) {
      await connection.end();
      console.log("🔌 Database connection closed");
    }
  }
}

// Run the debug
debugTelephoneIssue().catch(console.error);
