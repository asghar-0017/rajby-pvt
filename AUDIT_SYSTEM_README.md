# Audit System Documentation

## Overview

The FBR Invoice Application now includes a comprehensive audit trail system that tracks all CRUD (Create, Read, Update, Delete) operations on invoices, buyers, products, and users. This system provides administrators with complete visibility into who performed what actions and when.

## Features

### 🔍 **Complete Activity Tracking**
- **CREATE**: Track when new invoices, buyers, products, or users are created
- **UPDATE**: Monitor all modifications with before/after values
- **DELETE**: Record deletions with complete entity data
- **User Attribution**: Every action is linked to the user who performed it
- **Timestamp Tracking**: Precise timestamps for all operations
- **IP Address Logging**: Track the source IP of each operation

### 📊 **Admin Dashboard**
- **Audit Logs**: Detailed view of all system activities
- **Audit Summary**: Overview of entity lifecycle and modifications
- **Statistics**: Comprehensive analytics on system usage
- **Filtering**: Advanced filtering by entity type, operation, user, date range
- **Export**: CSV export functionality for audit logs
- **Real-time Updates**: Live monitoring of system activities

### 🔐 **Permission-Based Access**
- **Role-based Permissions**: Different audit access levels for different roles
- **Admin Override**: Administrators have full audit access
- **Granular Control**: Specific permissions for different audit views

## Database Schema

### Core Tables

#### `audit_logs`
Stores detailed audit trail for every operation:
```sql
- id: Primary key
- entity_type: Type of entity (invoice, buyer, product, user)
- entity_id: ID of the affected entity
- operation: Type of operation (CREATE, UPDATE, DELETE)
- user_id: ID of user who performed the operation
- user_email: Email of the user
- user_name: Full name of the user
- user_role: Role of the user
- tenant_id: Tenant/Company ID
- tenant_name: Tenant/Company name
- old_values: Previous values (JSON)
- new_values: New values (JSON)
- changed_fields: List of changed fields (JSON)
- ip_address: IP address of the user
- user_agent: User agent string
- request_id: Unique request identifier
- additional_info: Additional context (JSON)
- created_at: Timestamp
```

#### `audit_summary`
Provides quick overview of entity lifecycle:
```sql
- id: Primary key
- entity_type: Type of entity
- entity_id: ID of the entity
- entity_name: Human-readable name
- total_operations: Total number of operations
- created_by_user_id: User who created the entity
- created_by_email: Email of creator
- created_by_name: Name of creator
- created_at: Creation timestamp
- last_modified_by_user_id: User who last modified
- last_modified_by_email: Email of last modifier
- last_modified_by_name: Name of last modifier
- last_modified_at: Last modification timestamp
- tenant_id: Tenant ID
- tenant_name: Tenant name
- is_deleted: Whether entity is deleted
- deleted_by_user_id: User who deleted
- deleted_by_email: Email of deleter
- deleted_by_name: Name of deleter
- deleted_at: Deletion timestamp
```

#### `audit_permissions`
Controls access to audit functionality:
```sql
- id: Primary key
- permission_name: Permission identifier
- display_name: Human-readable name
- description: Permission description
- is_active: Whether permission is active
```

## API Endpoints

### Audit Management Endpoints

#### Get Audit Logs
```
GET /api/audit/logs
```
**Query Parameters:**
- `entityType`: Filter by entity type (invoice, buyer, product, user)
- `operation`: Filter by operation (CREATE, UPDATE, DELETE)
- `userId`: Filter by user ID
- `userEmail`: Filter by user email
- `tenantId`: Filter by tenant ID
- `startDate`: Filter by start date
- `endDate`: Filter by end date
- `search`: Search in user names, emails, entity names
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50, max: 100)
- `sortBy`: Sort field (default: created_at)
- `sortOrder`: Sort order (ASC/DESC, default: DESC)

#### Get Audit Summary
```
GET /api/audit/summary
```
**Query Parameters:** Same as audit logs

#### Get Audit Statistics
```
GET /api/audit/statistics
```
**Query Parameters:**
- `tenantId`: Filter by tenant ID
- `startDate`: Filter by start date
- `endDate`: Filter by end date

#### Get Entity Audit Logs
```
GET /api/audit/entity/:entityType/:entityId
```

#### Get User Audit Logs
```
GET /api/audit/user/:userId
```

#### Get Tenant Audit Logs
```
GET /api/audit/tenant/:tenantId
```

#### Export Audit Logs
```
GET /api/audit/export
```
**Query Parameters:** Same as audit logs
- `format`: Export format (csv/json, default: csv)

## Frontend Interface

### Audit Management Page
Accessible at `/audit-management` for users with `view_audit_logs` permission.

#### Features:
- **Three Main Tabs:**
  - **Audit Logs**: Detailed activity log with filtering
  - **Summary**: Entity lifecycle overview
  - **Statistics**: Usage analytics and insights

- **Advanced Filtering:**
  - Entity type (Invoice, Buyer, Product, User)
  - Operation type (Create, Update, Delete)
  - User email search
  - Date range filtering
  - General search across names and emails

- **Export Functionality:**
  - CSV export of filtered audit logs
  - Includes all relevant audit information

- **Real-time Statistics:**
  - Total operations count
  - Operations by type (Create/Update/Delete)
  - Operations by entity type
  - Top users by activity
  - Recent activity metrics

## Setup Instructions

### 1. Database Setup
Run the audit system setup script:
```bash
cd apps/backend
node scripts/setup-audit-system.js
```

This script will:
- Create all necessary audit tables
- Set up indexes for performance
- Insert audit permissions
- Assign permissions to existing roles
- Create database views for easy querying

### 2. Backend Configuration
The audit system is automatically integrated into the existing controllers:
- `invoiceController.js`: Audits invoice operations
- `buyerController.js`: Audits buyer operations
- `productController.js`: Audits product operations
- `userManagementController.js`: Audits user operations

### 3. Frontend Integration
The audit management interface is automatically available in the sidebar for users with appropriate permissions.

## Usage Examples

### Viewing Audit Logs
1. Navigate to **Audit Management** in the sidebar
2. Select the **Audit Logs** tab
3. Use filters to narrow down results:
   - Filter by entity type to see only invoice operations
   - Filter by operation to see only deletions
   - Filter by user to see all actions by a specific user
   - Use date range to see activities in a specific period

### Monitoring User Activity
1. Go to **Audit Management** → **Statistics** tab
2. View **Top Users by Activity** to see who's most active
3. Use the **User Email** filter in Audit Logs to see detailed activity for a specific user

### Tracking Entity Changes
1. Go to **Audit Management** → **Summary** tab
2. See overview of all entities and their modification history
3. Click on specific entities to see detailed change history

### Exporting Audit Data
1. Apply desired filters in **Audit Logs** tab
2. Click **Export CSV** button
3. Download will include all filtered audit data

## Security Considerations

### Access Control
- Only users with `view_audit_logs` permission can access audit data
- Admin users have full audit access by default
- Audit permissions are role-based and can be customized

### Data Privacy
- Audit logs contain user information and should be treated as sensitive
- IP addresses are logged for security purposes
- Old values are stored for complete audit trail

### Performance
- Audit tables are indexed for optimal query performance
- Pagination is enforced to prevent large data loads
- Export functionality is rate-limited

## Troubleshooting

### Common Issues

#### Audit Logs Not Appearing
- Check if audit middleware is properly integrated
- Verify user has appropriate permissions
- Ensure database tables are created correctly

#### Performance Issues
- Check database indexes are created
- Use appropriate filters to limit result sets
- Consider archiving old audit data

#### Permission Errors
- Verify user has `view_audit_logs` permission
- Check role assignments in user management
- Ensure admin users have proper access

### Database Maintenance

#### Archiving Old Data
```sql
-- Archive audit logs older than 1 year
INSERT INTO audit_logs_archive 
SELECT * FROM audit_logs 
WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 YEAR);

DELETE FROM audit_logs 
WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 YEAR);
```

#### Performance Optimization
```sql
-- Add additional indexes if needed
CREATE INDEX idx_audit_logs_entity_created ON audit_logs(entity_type, created_at);
CREATE INDEX idx_audit_logs_user_created ON audit_logs(user_id, created_at);
```

## Future Enhancements

### Planned Features
- **Real-time Notifications**: Alert admins of critical operations
- **Audit Reports**: Scheduled audit reports via email
- **Data Retention Policies**: Automatic cleanup of old audit data
- **Advanced Analytics**: Machine learning insights on user behavior
- **Audit Trail Visualization**: Graphical representation of entity changes

### Integration Opportunities
- **SIEM Integration**: Export audit data to security information systems
- **Compliance Reporting**: Generate compliance reports for regulations
- **API Monitoring**: Track API usage and performance
- **User Behavior Analytics**: Analyze patterns in user activities

## Support

For issues or questions regarding the audit system:
1. Check the troubleshooting section above
2. Review the database setup logs
3. Verify permissions and role assignments
4. Contact the development team for advanced issues

---

**Note**: This audit system provides comprehensive tracking of all system activities. Ensure compliance with data protection regulations and implement appropriate data retention policies based on your organization's requirements.
