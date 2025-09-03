-- Add missing columns to invoices table
-- Run this script to add the internal_invoice_no column

-- Add internal_invoice_no column if it doesn't exist
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS internal_invoice_no VARCHAR(100) NULL 
AFTER companyInvoiceRefNo;

-- Verify the column was added
DESCRIBE invoices;
