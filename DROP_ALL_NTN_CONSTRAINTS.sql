-- ====================================================================
-- DROP ALL UNIQUE CONSTRAINTS ON buyerNTNCNIC COLUMN
-- ====================================================================
-- This script removes ALL unique constraints from the buyerNTNCNIC column
-- to allow the same NTN to be used by multiple buyers with different details.
--
-- IMPORTANT: Run this on your tenant database (e.g., rajby_db)
-- ====================================================================

USE rajby_db;  -- Change this to your actual tenant database name

-- Show current indexes on buyers table (for verification)
SHOW INDEX FROM buyers WHERE Column_name = 'buyerNTNCNIC';

-- Drop all possible unique constraint names
ALTER TABLE buyers DROP INDEX IF EXISTS buyerNTNCNIC;
ALTER TABLE buyers DROP INDEX IF EXISTS buyerNTNCNIC_2;
ALTER TABLE buyers DROP INDEX IF EXISTS buyerNTNCNIC_3;
ALTER TABLE buyers DROP INDEX IF EXISTS buyers_buyerNTNCNIC_key;
ALTER TABLE buyers DROP INDEX IF EXISTS buyers_buyerNTNCNIC_unique;
ALTER TABLE buyers DROP INDEX IF EXISTS idx_buyerNTNCNIC;
ALTER TABLE buyers DROP INDEX IF EXISTS buyerNTNCNIC_unique;

-- Verify all constraints are dropped
SHOW INDEX FROM buyers WHERE Column_name = 'buyerNTNCNIC';

-- Create non-unique index for better query performance (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_buyer_ntn_lookup ON buyers (buyerNTNCNIC);

-- Create composite index for duplicate checking (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_buyer_composite ON buyers (
    buyerId(50), 
    buyerMainName(100), 
    buyerBusinessName(100), 
    buyerNTNCNIC(50), 
    buyerProvince(50), 
    buyerAddress(100)
);

-- Verify final state
SHOW INDEX FROM buyers;

SELECT 'SUCCESS: All unique constraints on buyerNTNCNIC have been removed!' AS Status;

