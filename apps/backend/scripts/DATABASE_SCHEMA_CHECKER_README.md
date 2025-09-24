# Database Schema Checker and Auto-Creator

This directory contains scripts to automatically check and create missing database tables, columns, and indexes based on your Sequelize model definitions.

## Scripts Overview

### 1. `check-and-create-missing-schema.js` (Comprehensive)
A full-featured script that performs detailed schema checking and creation.

**Features:**
- Checks master database tables, columns, and indexes
- Checks tenant-specific database schemas
- Creates missing tables with proper structure
- Adds missing columns with correct data types
- Creates missing indexes and foreign key constraints
- Supports dry-run mode for testing
- Detailed logging and error reporting

### 2. `schema-checker-simple.js` (Simple)
A simplified version that focuses on the most common missing schema issues.

**Features:**
- Quick schema synchronization using Sequelize sync
- Checks for commonly missing columns
- Works with both master and tenant databases
- Minimal configuration required

## Usage

### Quick Start (Recommended)
```bash
# Navigate to the backend directory
cd apps/backend

# Run the simple schema checker
node scripts/schema-checker-simple.js
```

### Advanced Usage
```bash
# Check master database only
node scripts/check-and-create-missing-schema.js --master-only

# Check tenant databases only
node scripts/check-and-create-missing-schema.js --tenant-only

# Dry run (check what would be created without making changes)
node scripts/check-and-create-missing-schema.js --dry-run

# Check everything (default)
node scripts/check-and-create-missing-schema.js
```

## What the Scripts Check and Create

### Master Database Tables
- `tenants` - Tenant/company information
- `users` - User accounts and authentication
- `roles` - User roles
- `permissions` - System permissions
- `role_permissions` - Role-permission mappings
- `audit_logs` - Audit trail for all operations
- `audit_permissions` - Audit-specific permissions

### Tenant Database Tables
- `buyers` - Buyer information
- `products` - Product catalog
- `invoices` - Invoice records
- `invoice_items` - Invoice line items

### Common Missing Columns
The scripts automatically check for and create these commonly missing columns:

**Users Table:**
- `role_id` - Foreign key to roles table

**Invoices Table:**
- `internal_invoice_no` - Internal invoice reference number
- `created_by_user_id` - User who created the invoice
- `created_by_email` - Email of creator
- `created_by_name` - Name of creator

**Buyers Table:**
- `created_by_user_id` - User who created the buyer
- `created_by_email` - Email of creator
- `created_by_name` - Name of creator

**Products Table:**
- `created_by_user_id` - User who created the product
- `created_by_email` - Email of creator
- `created_by_name` - Name of creator

## Environment Setup

Make sure your environment variables are properly configured:

```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=your_username
MYSQL_PASSWORD=your_password
MYSQL_MASTER_DB=your_master_database
```

## Output Examples

### Successful Run
```
🚀 Simple Database Schema Checker
========================================
✅ Connected to master database

🔍 Checking Master Database...

✅ Master table synchronized: tenants
✅ Master table synchronized: users
✅ Master table synchronized: roles
✅ Master table synchronized: permissions
✅ Master table synchronized: role_permissions
✅ Master table synchronized: audit_logs
✅ Master table synchronized: audit_permissions

🔍 Checking Tenant Databases...

📋 Checking tenant: Company ABC
✅ Added column: invoices.internal_invoice_no
✅ Added column: buyers.created_by_user_id

==================================================
📊 SCHEMA CHECK RESULTS
==================================================
✅ Tables synchronized: 7
✅ Columns added: 2

🎉 No errors encountered!
==================================================
```

### Error Handling
```
❌ Error creating table users: ER_DUP_ENTRY: Duplicate entry 'admin' for key 'users.email'
❌ Error adding column invoices.internal_invoice_no: ER_DUP_FIELDNAME: Duplicate column name 'internal_invoice_no'
```

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Verify your MySQL credentials in environment variables
   - Ensure MySQL server is running
   - Check network connectivity

2. **Permission Errors**
   - Ensure the database user has CREATE, ALTER, and INDEX privileges
   - For tenant databases, ensure the user can access all tenant databases

3. **Duplicate Column Errors**
   - These are usually safe to ignore - the column already exists
   - The script will continue with other operations

4. **Foreign Key Constraint Errors**
   - Ensure referenced tables exist before creating foreign keys
   - Check that referenced columns have the correct data types

### Manual Schema Fixes

If the scripts encounter issues, you can manually run SQL commands:

```sql
-- Add missing column
ALTER TABLE invoices ADD COLUMN internal_invoice_no VARCHAR(100) NULL;

-- Create missing index
CREATE INDEX idx_user_email ON users (email);

-- Add foreign key constraint
ALTER TABLE users ADD CONSTRAINT fk_users_role 
FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE SET NULL;
```

## Integration with CI/CD

You can integrate these scripts into your deployment pipeline:

```bash
# In your deployment script
echo "Checking database schema..."
node scripts/schema-checker-simple.js

if [ $? -eq 0 ]; then
    echo "Schema check passed"
else
    echo "Schema check failed"
    exit 1
fi
```

## Best Practices

1. **Run Before Deployment**: Always run schema checks before deploying new code
2. **Use Dry Run First**: Test with `--dry-run` to see what changes will be made
3. **Backup Database**: Create backups before running schema changes in production
4. **Monitor Logs**: Check the output for any errors or warnings
5. **Test in Staging**: Run schema checks in staging environment first

## Support

If you encounter issues with the schema checker scripts:

1. Check the error messages in the console output
2. Verify your database connection and permissions
3. Review the Sequelize model definitions for any syntax errors
4. Check the MySQL error logs for detailed error information

## Related Scripts

- `setup-role-permission-system.js` - Sets up roles and permissions
- `create-user-management-tables.sql` - Creates user management tables
- `create-audit-system.sql` - Creates audit system tables
- `add-missing-columns.sql` - Adds specific missing columns
