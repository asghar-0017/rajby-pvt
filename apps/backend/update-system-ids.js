#!/usr/bin/env node

import mysql2 from "mysql2/promise";

const dbConfig = {
  host: "157.245.150.54",
  user: "root",
  password: "root",
  port: 3307,
  database: "innovative123",
};

// Helper function to generate system invoice ID
const generateSystemInvoiceId = (sequenceNumber) => {
  return `INV-${sequenceNumber.toString().padStart(4, "0")}`;
};

async function updateSystemInvoiceIds() {
  const connection = await mysql2.createConnection(dbConfig);

  try {
    console.log("🚀 Starting system invoice ID update...");

    // Get all existing invoices that don't have system_invoice_id
    const [invoices] = await connection.execute(`
      SELECT id FROM invoices WHERE system_invoice_id IS NULL ORDER BY created_at ASC
    `);

    console.log(`📊 Found ${invoices.length} existing invoices to update`);

    // Update each invoice with a system invoice ID
    for (let i = 0; i < invoices.length; i++) {
      const invoice = invoices[i];
      const systemInvoiceId = generateSystemInvoiceId(i + 1);

      await connection.execute(
        `
        UPDATE invoices 
        SET system_invoice_id = ? 
        WHERE id = ?
      `,
        [systemInvoiceId, invoice.id]
      );

      console.log(
        `   ✅ Updated invoice ${invoice.id} with system ID: ${systemInvoiceId}`
      );
    }

    console.log("\n🎉 All invoices updated successfully!");
  } catch (error) {
    console.error("❌ Update failed:", error);
    throw error;
  } finally {
    await connection.end();
  }
}

// Run the update
updateSystemInvoiceIds()
  .then(() => {
    console.log("✅ Update script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Update script failed:", error);
    process.exit(1);
  });
