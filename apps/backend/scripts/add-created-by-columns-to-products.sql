-- Add created_by columns to products table
-- Run this script to add the creator tracking columns

-- Add created_by_user_id column if it doesn't exist
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS created_by_user_id INT NULL;

-- Add created_by_email column if it doesn't exist
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS created_by_email VARCHAR(255) NULL;

-- Add created_by_name column if it doesn't exist
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS created_by_name VARCHAR(255) NULL;

-- Verify the columns were added
DESCRIBE products;
