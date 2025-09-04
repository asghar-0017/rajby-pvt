-- Performance optimization indexes for Buyer uploader
-- Run this script to add indexes that will significantly improve bulk upload performance

-- Indexes for Buyer table (for bulk validation and upload)
CREATE INDEX IF NOT EXISTS idx_buyers_ntn_cnic ON buyers(buyerNTNCNIC);
CREATE INDEX IF NOT EXISTS idx_buyers_business_name ON buyers(buyerBusinessName);
CREATE INDEX IF NOT EXISTS idx_buyers_province ON buyers(buyerProvince);
CREATE INDEX IF NOT EXISTS idx_buyers_registration_type ON buyers(buyerRegistrationType);
CREATE INDEX IF NOT EXISTS idx_buyers_created_at ON buyers(created_at);

-- Composite index for buyer lookups during bulk upload
CREATE INDEX IF NOT EXISTS idx_buyers_bulk_lookup ON buyers(buyerNTNCNIC, buyerBusinessName);
CREATE INDEX IF NOT EXISTS idx_buyers_province_lookup ON buyers(buyerProvince, buyerRegistrationType);

-- Performance monitoring query to check index usage
-- Run this after adding indexes to verify they're being used
SELECT 
    TABLE_NAME,
    INDEX_NAME,
    CARDINALITY,
    INDEX_TYPE
FROM information_schema.STATISTICS 
WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'buyers'
ORDER BY INDEX_NAME;
