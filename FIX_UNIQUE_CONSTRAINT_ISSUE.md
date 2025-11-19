# 🔧 URGENT FIX: Drop Unique Constraint on buyerNTNCNIC

## The Problem

Your database has a unique constraint called `buyerNTNCNIC_2` that is preventing multiple buyers from having the same NTN.

**Error:** `Duplicate entry '4111664' for key 'buyers.buyerNTNCNIC_2'`

This is blocking your bulk upload because you have legitimate cases where the same NTN is used by different companies:
- `01001207001001` - Loft Commercials Limited (NTN: 4111664-0)
- `01001329001001` - Loftex Limited (NTN: 4111664-0)

## Quick Fix (Choose ONE method)

### Method 1: Run SQL Script Directly (Fastest) ⚡

1. Open your MySQL client (MySQL Workbench, phpMyAdmin, HeidiSQL, or command line)
2. Connect to your database
3. Run the `DROP_ALL_NTN_CONSTRAINTS.sql` file I just created
4. Restart your backend server

**Using MySQL Command Line:**
```bash
# Navigate to your project directory
cd C:\Users\asghar.ali\Documents\fbr_rajbytextilespvtltd

# Run the SQL script
mysql -u your_username -p rajby_db < DROP_ALL_NTN_CONSTRAINTS.sql
```

**Or copy-paste this SQL directly:**
```sql
USE rajby_db;  -- Change to your actual database name

-- Show what exists
SHOW INDEX FROM buyers WHERE Column_name = 'buyerNTNCNIC';

-- Drop all unique constraints
ALTER TABLE buyers DROP INDEX IF EXISTS buyerNTNCNIC;
ALTER TABLE buyers DROP INDEX IF EXISTS buyerNTNCNIC_2;
ALTER TABLE buyers DROP INDEX IF EXISTS buyerNTNCNIC_3;
ALTER TABLE buyers DROP INDEX IF EXISTS buyers_buyerNTNCNIC_key;

-- Verify they're gone
SHOW INDEX FROM buyers WHERE Column_name = 'buyerNTNCNIC';
```

### Method 2: Run Auto-Schema-Sync (Automated) 🤖

The script is now updated to be more aggressive about finding and dropping constraints.

```bash
cd apps/backend
node src/config/auto-schema-sync.js
```

## Verify the Fix

After running either method, verify:

1. **Check indexes are gone:**
   ```sql
   SHOW INDEX FROM buyers WHERE Column_name = 'buyerNTNCNIC';
   ```
   Should return NO unique indexes.

2. **Restart your backend server** (important!)

3. **Try your bulk upload again**

## What Was Fixed

1. ✅ Updated `auto-schema-sync.js` to:
   - Query actual indexes on the column
   - Drop ALL found indexes dynamically
   - Try common constraint names

2. ✅ Created `DROP_ALL_NTN_CONSTRAINTS.sql` for manual execution

3. ✅ Now allows duplicate NTNs across different buyers

## After the Fix

Once constraints are dropped, you can have multiple buyers with the same NTN **as long as other fields differ**:

```json
[
  {
    "buyerId": "01001207001001",
    "buyerMainName": "Fabric",
    "buyerBusinessName": "Loft Commercials Limited.",
    "buyerNTNCNIC": "4111664-0"  // ← Same NTN
  },
  {
    "buyerId": "01001329001001",
    "buyerMainName": "Fabric",
    "buyerBusinessName": "Loftex Limited",  // ← Different business name
    "buyerNTNCNIC": "4111664-0"  // ← Same NTN (OK!)
  }
]
```

## Need Help?

If the error persists:
1. Send me the output of: `SHOW INDEX FROM buyers;`
2. Check your database name is correct in the SQL script
3. Make sure you restarted the backend server after dropping constraints

