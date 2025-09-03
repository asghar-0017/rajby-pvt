-- Performance optimization indexes for BulInvoice uploader
-- Run this script to add indexes that will significantly improve bulk upload performance

-- Indexes for Invoice table
CREATE INDEX IF NOT EXISTS idx_invoices_system_invoice_id ON invoices(system_invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_buyer_ntn_cnic ON invoices(buyerNTNCNIC);
CREATE INDEX IF NOT EXISTS idx_invoices_company_invoice_ref_no ON invoices(companyInvoiceRefNo);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_buyer_business_name ON invoices(buyerBusinessName);

-- Composite index for bulk operations
CREATE INDEX IF NOT EXISTS idx_invoices_bulk_lookup ON invoices(buyerNTNCNIC, status, created_at);

-- Indexes for InvoiceItem table
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_name ON invoice_items(name);
CREATE INDEX IF NOT EXISTS idx_invoice_items_hs_code ON invoice_items(hsCode);
CREATE INDEX IF NOT EXISTS idx_invoice_items_created_at ON invoice_items(created_at);

-- Indexes for Buyer table (for bulk validation)
CREATE INDEX IF NOT EXISTS idx_buyers_ntn_cnic ON buyers(buyerNTNCNIC);
CREATE INDEX IF NOT EXISTS idx_buyers_business_name ON buyers(buyerBusinessName);
CREATE INDEX IF NOT EXISTS idx_buyers_province ON buyers(buyerProvince);

-- Composite index for buyer lookups during bulk upload
CREATE INDEX IF NOT EXISTS idx_buyers_bulk_lookup ON buyers(buyerNTNCNIC, buyerBusinessName);

-- Performance monitoring query to check index usage
-- Run this after adding indexes to verify they're being used
SELECT 
    TABLE_NAME,
    INDEX_NAME,
    CARDINALITY,
    INDEX_TYPE
FROM information_schema.STATISTICS 
WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME IN ('invoices', 'invoice_items', 'buyers')
ORDER BY TABLE_NAME, CARDINALITY DESC;
