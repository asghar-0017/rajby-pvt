# Quick Start Guide - Database Schema Checker

## 🚀 Quick Start

### 1. Test the Schema Checker (No Database Required)
```bash
cd apps/backend
node scripts/test-schema-checker.js
```

This will show you what tables, columns, and indexes the script would check/create without connecting to the database.

### 2. Run the Simple Schema Checker
```bash
cd apps/backend
node scripts/schema-checker-simple.js
```

This will:
- Connect to your master database
- Check and create missing master tables
- Check and add missing columns
- Check all tenant databases
- Add missing columns to tenant tables

### 3. Run the Comprehensive Schema Checker
```bash
cd apps/backend

# Check everything
node scripts/check-and-create-missing-schema.js

# Dry run (see what would be created)
node scripts/check-and-create-missing-schema.js --dry-run

# Check only master database
node scripts/check-and-create-missing-schema.js --master-only

# Check only tenant databases
node scripts/check-and-create-missing-schema.js --tenant-only
```

## 📋 What Gets Checked/Created

### Master Database Tables
- `tenants` - Company/tenant information
- `users` - User accounts
- `roles` - User roles
- `permissions` - System permissions
- `role_permissions` - Role-permission mappings
- `audit_logs` - Audit trail
- `audit_permissions` - Audit permissions

### Tenant Database Tables
- `buyers` - Buyer information
- `products` - Product catalog
- `invoices` - Invoice records
- `invoice_items` - Invoice line items

### Common Missing Columns
- `users.role_id` - Links users to roles
- `invoices.internal_invoice_no` - Internal invoice reference
- `buyers.created_by_*` - Creator tracking fields
- `products.created_by_*` - Creator tracking fields
- `invoices.created_by_*` - Creator tracking fields

## ⚙️ Environment Setup

Make sure these environment variables are set in your `.env` file:

```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=your_username
MYSQL_PASSWORD=your_password
MYSQL_MASTER_DB=your_master_database
```

## 🔧 Troubleshooting

### Database Connection Issues
If you get connection errors:
1. Check your MySQL server is running
2. Verify your credentials in `.env`
3. Ensure the database user has CREATE/ALTER permissions

### Permission Errors
Make sure your database user has these privileges:
- CREATE
- ALTER
- INDEX
- SELECT
- INSERT
- UPDATE

### Common Errors
- **Duplicate column errors**: Safe to ignore - column already exists
- **Foreign key errors**: Usually means referenced table doesn't exist yet
- **Access denied**: Check database user permissions

## 📊 Expected Output

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

## 🎯 When to Use

- **Before deployment**: Run to ensure database schema is up to date
- **After model changes**: When you add new fields to Sequelize models
- **Database migration**: When setting up new environments
- **Troubleshooting**: When getting "column doesn't exist" errors

## 📚 More Information

- See `DATABASE_SCHEMA_CHECKER_README.md` for detailed documentation
- Check the individual script files for advanced options
- Review your Sequelize models in `src/model/mysql/` to understand the expected schema
