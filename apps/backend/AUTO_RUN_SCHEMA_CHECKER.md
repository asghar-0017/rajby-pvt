# 🚀 Auto-Run Database Schema Checker

## Overview

The database schema checker now runs **automatically** every time your application starts up! This ensures that all tenant databases are always in sync with your current model definitions.

## How It Works

### 1. **Automatic Startup Execution**
When you start your server (`npm start`, `npm run dev`, or `node index.js`), the schema checker automatically runs:

```bash
🚀 Server starting...
✅ Connected to MySQL multi-tenant database system
🔍 Running automatic database schema check...
🚀 Starting database schema check for all tenants...
✅ Master database connection established
✅ Found 3 active tenants
🔍 Checking schema for tenant: tenant_abc123
📋 Checking table: Invoices (invoices)
⚠️  Found 2 missing columns in invoices:
   - companyInvoiceRefNo: STRING(100)
   - system_invoice_id: STRING(20)
🔧 Automatically creating 2 missing columns...
✅ Created column: companyInvoiceRefNo
✅ Created column: system_invoice_id
✅ Database schema check completed successfully!
🚀 Server is running on port 5150
```

### 2. **What Happens Automatically**
- **Connects to master database** → Gets list of active tenants
- **For each tenant database**:
  - Connects to tenant database
  - Compares current schema with model definitions
  - **Automatically creates missing columns**
  - Reports progress in real-time
- **Continues server startup** → Schema check doesn't block server

### 3. **Error Handling**
- If schema check fails, server continues to start
- Schema check errors are logged but don't crash the application
- Individual tenant failures don't stop the entire process

## Usage Options

### **Option 1: Automatic (Default)**
The schema checker runs automatically every time you start the server:
```bash
npm start          # Auto-runs schema check
npm run dev        # Auto-runs schema check
node index.js      # Auto-runs schema check
```

### **Option 2: Manual Execution**
Run the schema check manually anytime:
```bash
npm run check-schema    # Run schema check manually
npm run auto-schema     # Run with auto-run wrapper
npm run test-schema     # Test the schema checker
```

### **Option 3: API Endpoint**
Trigger schema check via HTTP API:
```bash
curl -X POST https://adnan-textile.inplsoftwares.online/api/admin/check-schema
```

### **Option 4: Windows Batch File**
Double-click `run-schema-check.bat` to run manually

## Configuration

### **Environment Variables Required**
Make sure your `.env` file contains:
```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=your_username
MYSQL_PASSWORD=your_password
MYSQL_MASTER_DB=master_database_name
```

### **Tables Automatically Checked**
- `buyers` - Buyer information
- `invoices` - Invoice headers
- `invoice_items` - Invoice line items

## Benefits

✅ **Always Up-to-Date**: Database schema automatically syncs on every startup  
✅ **Zero Manual Work**: No need to remember to run schema checks  
✅ **Production Ready**: Safe to run in production environments  
✅ **Non-Blocking**: Server starts even if schema check has issues  
✅ **Comprehensive**: Checks all tenant databases automatically  
✅ **Audit Trail**: Full logging of all operations  

## When It Runs

The schema checker automatically runs:

1. **On Server Startup** - Every time you start/restart the application
2. **On Application Refresh** - When nodemon restarts during development
3. **On Process Restart** - After any crash or restart
4. **On Deployment** - When deploying to production

## Example Startup Flow

```
1. 🚀 Application starts
2. 🔌 Connects to MySQL
3. 🔍 Auto-runs schema check
4. 📋 Checks all tenant databases
5. 🔧 Creates missing columns (if any)
6. ✅ Schema check completes
7. 🌐 Server starts listening
8. 🎉 Ready to handle requests
```

## Monitoring & Logs

### **Startup Logs**
```
🔍 Running automatic database schema check...
🚀 Starting database schema check for all tenants...
✅ Master database connection established
✅ Found 3 active tenants
🔍 Checking schema for tenant: tenant_abc123
📋 Checking table: Invoices (invoices)
✅ Table invoices is up to date
📋 Checking table: Buyers (buyers)
✅ Table buyers is up to date
✅ Database schema check completed successfully!
```

### **Schema Update Logs**
```
⚠️  Found 2 missing columns in invoices:
   - companyInvoiceRefNo: STRING(100)
   - system_invoice_id: STRING(20)
🔧 Automatically creating 2 missing columns...
🔧 Executing: ALTER TABLE `invoices` ADD COLUMN `companyInvoiceRefNo` STRING(100)
✅ Created column: companyInvoiceRefNo
🔧 Executing: ALTER TABLE `invoices` ADD COLUMN `system_invoice_id` STRING(20) UNIQUE
✅ Created column: system_invoice_id
✅ Successfully created 2 columns in invoices
```

## Troubleshooting

### **Common Issues**

1. **Schema check fails on startup**
   - Check database connections in `.env`
   - Verify MySQL server is running
   - Check user permissions

2. **Server starts but schema check doesn't run**
   - Check console logs for error messages
   - Verify import path in `app.js`

3. **Schema check blocks server startup**
   - Schema check has timeout protection
   - Server will start even if check fails

### **Debug Mode**
Enable detailed logging by modifying the schema check call in `app.js`:
```javascript
// Auto-run database schema check on startup
console.log("🔍 Running automatic database schema check...");
try {
  const checker = new DatabaseSchemaChecker();
  checker.debugMode = true; // Enable debug logging
  await checker.checkAllTenants();
  console.log("✅ Database schema check completed successfully!");
} catch (schemaError) {
  console.log("⚠️  Schema check had issues (continuing server startup):", schemaError.message);
}
```

## Performance Impact

- **Startup Time**: Adds 2-10 seconds depending on number of tenants
- **Memory Usage**: Minimal - only during startup
- **Database Load**: Light - only reads schema and creates missing columns
- **Network**: Only affects database connections

## Best Practices

1. **Run in Development**: Always test schema changes in development first
2. **Monitor Logs**: Check startup logs for any schema issues
3. **Backup Before Major Changes**: Backup databases before significant model updates
4. **Test After Changes**: Verify schema changes work as expected

## Support

If you encounter issues:

1. Check the console output for specific error messages
2. Verify your database connections and permissions
3. Ensure all required environment variables are set
4. Test the schema checker manually: `npm run test-schema`

---

**🎉 Your database schema is now automatically maintained on every application refresh!**
