# Audit & User Management System Setup

This directory contains comprehensive scripts to set up the audit system and user management with roles and permissions for the FBR Invoice Application.

## Files Overview

### 1. SQL Scripts
- **`setup-complete-audit-user-management-system.sql`** - Complete SQL script that creates all tables, inserts data, and sets up the entire system
- **`insert-audit-permissions.sql`** - Inserts audit-specific permissions
- **`update-audit-operations.sql`** - Updates audit operations and adds new invoice operation types

### 2. JavaScript Scripts
- **`setup-complete-audit-user-management-system.js`** - Node.js script that programmatically sets up the entire system with error handling and logging

## Quick Setup

### Option 1: Using SQL Script (Recommended for Production)
```bash
# Connect to your MySQL database and run:
mysql -u your_username -p your_database_name < setup-complete-audit-user-management-system.sql
```

### Option 2: Using JavaScript Script (Recommended for Development)
```bash
# Navigate to the backend directory
cd apps/backend

# Set environment variables (optional, defaults provided)
export DB_HOST=localhost
export DB_USER=root
export DB_PASSWORD=your_password
export DB_NAME=fbr_diamondindustries

# Run the setup script
node scripts/setup-complete-audit-user-management-system.js
```

## What Gets Created

### Tables
1. **`users`** - User accounts with role assignments
2. **`user_tenant_assignments`** - Many-to-many relationship between users and tenants
3. **`roles`** - System roles (admin, invoice_creator, buyer_manager, etc.)
4. **`permissions`** - Granular permissions for different operations
5. **`role_permissions`** - Junction table linking roles to permissions
6. **`audit_logs`** - Detailed audit trail for all operations
7. **`audit_summary`** - Summary view of audit data for quick access
8. **`audit_permissions`** - Permissions specifically for audit system access

### Default Roles
- **`admin`** - Full system access with all permissions
- **`invoice_creator`** - Can create, edit, and manage invoices
- **`buyer_manager`** - Can manage buyers and buyer-related operations
- **`product_manager`** - Can manage products and product-related operations
- **`viewer`** - Read-only access to view data

### Permission Categories
- **User Management** - create_user, read_user, update_user, delete_user
- **Role Management** - create_role, read_role, update_role, delete_role
- **Invoice Management** - create_invoice, read_invoice, update_invoice, delete_invoice, invoice_uploader, invoice_validate, invoice_save
- **Buyer Management** - create_buyer, read_buyer, update_buyer, delete_buyer, buyer_uploader
- **Product Management** - create_product, read_product, update_product, delete_product, product_uploader
- **Dashboard & Reports** - view_dashboard, report_view

### Audit Operations
- **CREATE** - New entity creation
- **UPDATE** - Entity modification
- **DELETE** - Entity deletion
- **SAVE_DRAFT** - Save invoice as draft
- **SAVE_AND_VALIDATE** - Save and validate invoice
- **SUBMIT_TO_FBR** - Submit invoice to FBR
- **BULK_CREATE** - Bulk upload operations

### Views
- **`audit_logs_detailed`** - Enhanced audit logs with user and tenant information
- **`audit_summary_detailed`** - Detailed audit summary with user information
- **`user_permissions_view`** - User permissions combined with role information

### Stored Procedures
- **`LogAuditEntry`** - Log audit entries with all required parameters
- **`UpdateAuditSummary`** - Update audit summary for entities

## Usage Examples

### Logging Audit Entries
```sql
CALL LogAuditEntry(
    'invoice', 123, 'CREATE', 
    1, 'user@example.com', 'John Doe', 'invoice_creator',
    1, 'Company Name', 
    NULL, '{"id": 123, "amount": 1000}', NULL,
    '192.168.1.1', 'Mozilla/5.0...', 'req-123', '{"source": "web"}'
);
```

### Querying Audit Logs
```sql
-- Get all audit logs for a specific user
SELECT * FROM audit_logs_detailed WHERE user_id = 1;

-- Get audit logs for a specific entity
SELECT * FROM audit_logs_detailed WHERE entity_type = 'invoice' AND entity_id = 123;

-- Get audit summary for all entities
SELECT * FROM audit_summary_detailed ORDER BY last_modified_at DESC;
```

### Checking User Permissions
```sql
-- Get all permissions for a user
SELECT * FROM user_permissions_view WHERE user_id = 1;

-- Check if user has specific permission
SELECT COUNT(*) as has_permission 
FROM user_permissions_view 
WHERE user_id = 1 AND permission_name = 'create_invoice';
```

## Integration with Sequelize Models

The system is designed to work with the existing Sequelize models. Make sure to:

1. Import the models in your associations file:
```javascript
import AuditLog from "./AuditLog.js";
import AuditSummary from "./AuditSummary.js";
import AuditPermission from "./AuditPermission.js";
```

2. Set up the associations as defined in `associations.js`

3. Use the audit logging in your controllers:
```javascript
// Example in invoice controller
await AuditLog.create({
    entity_type: 'invoice',
    entity_id: invoice.id,
    operation: 'CREATE',
    user_id: req.user.id,
    user_email: req.user.email,
    user_name: `${req.user.first_name} ${req.user.last_name}`,
    user_role: req.user.role?.name,
    tenant_id: req.user.tenant_id,
    tenant_name: req.user.tenant?.name,
    new_values: JSON.stringify(invoice.toJSON()),
    ip_address: req.ip,
    user_agent: req.get('User-Agent'),
    request_id: req.id
});
```

## Security Considerations

1. **Audit Logs** - Never delete audit logs in production. They provide compliance and security tracking.
2. **Permissions** - Always check permissions before allowing operations.
3. **Role Assignment** - Be careful when assigning admin roles to users.
4. **Data Privacy** - Consider what data should be logged in audit trails.

## Troubleshooting

### Common Issues

1. **Foreign Key Constraints** - Make sure referenced tables (tenants, admin_users) exist before running the setup.
2. **Permission Denied** - Ensure the database user has CREATE, ALTER, and INSERT permissions.
3. **Duplicate Key Errors** - The scripts use INSERT IGNORE to handle existing data gracefully.

### Verification

After running the setup, verify the installation:

```sql
-- Check if all tables exist
SHOW TABLES LIKE '%audit%';
SHOW TABLES LIKE '%role%';
SHOW TABLES LIKE '%permission%';

-- Check role assignments
SELECT r.name, COUNT(rp.permission_id) as permission_count 
FROM roles r 
LEFT JOIN role_permissions rp ON r.id = rp.role_id 
GROUP BY r.id, r.name;

-- Check audit permissions
SELECT * FROM audit_permissions;
```

## Support

For issues or questions about the audit and user management system setup, please refer to the main project documentation or contact the development team.
