# Invoice Backup System Documentation

## Overview

The Invoice Backup System provides comprehensive backup functionality for all invoice operations in the FBR Invoice Application. It automatically creates backups for drafts, saved invoices, edits, and FBR API interactions without showing in the UI, ensuring complete data integrity and audit trail.

## Features

### 🔄 **Automatic Backup Creation**
- **Draft Backups**: Created when invoices are saved as drafts
- **Saved Backups**: Created when invoices are saved and validated with FBR
- **Edit Backups**: Created when invoices are updated/edited (stores both old and new data)
- **Post Backups**: Created when invoices are posted to FBR
- **FBR Request Backups**: Created when data is sent to FBR API
- **FBR Response Backups**: Created when response is received from FBR API

### 📊 **Comprehensive Data Storage**
- Complete invoice data at time of backup
- Complete invoice items data
- FBR API request and response data
- User information and timestamps
- Status changes tracking
- Request metadata (IP, user agent, request ID)

### 🔍 **Backup Management**
- View backup history for any invoice
- Filter backups by type, date, user
- Export backup data to CSV
- Backup statistics and analytics
- Search and pagination support

## Database Schema

### Core Tables

#### `invoice_backups`
Stores detailed backup data for every invoice operation:
```sql
- id: Primary key
- original_invoice_id: ID of the original invoice
- system_invoice_id: System invoice ID for reference
- invoice_number: Invoice number at time of backup
- backup_type: Type of backup (DRAFT, SAVED, EDIT, POST, FBR_REQUEST, FBR_RESPONSE)
- backup_reason: Reason for backup
- status_before: Invoice status before the operation
- status_after: Invoice status after the operation
- invoice_data: Complete invoice data (JSON)
- invoice_items_data: Complete invoice items data (JSON)
- fbr_request_data: FBR API request data (JSON)
- fbr_response_data: FBR API response data (JSON)
- fbr_invoice_number: FBR invoice number if available
- user_id: ID of user who performed the operation
- user_email: Email of user who performed the operation
- user_name: Full name of user who performed the operation
- user_role: Role of user who performed the operation
- tenant_id: Tenant/Company ID
- tenant_name: Tenant/Company name
- ip_address: IP address of the user
- user_agent: User agent string
- request_id: Unique request identifier
- additional_info: Additional context information (JSON)
- created_at: Timestamp
```

#### `invoice_backup_summary`
Provides quick overview of backup activity per invoice:
```sql
- id: Primary key
- original_invoice_id: ID of the original invoice
- system_invoice_id: System invoice ID for reference
- current_invoice_number: Current invoice number
- current_status: Current invoice status
- total_backups: Total number of backups
- draft_backups: Number of draft backups
- saved_backups: Number of saved backups
- edit_backups: Number of edit backups
- post_backups: Number of post backups
- fbr_request_backups: Number of FBR request backups
- fbr_response_backups: Number of FBR response backups
- first_backup_at: Timestamp of first backup
- last_backup_at: Timestamp of last backup
- created_by_user_id: User who created the original invoice
- created_by_email: Email of creator
- created_by_name: Name of creator
- tenant_id: Tenant ID
- tenant_name: Tenant name
- created_at: Creation timestamp
- updated_at: Last update timestamp
```

## API Endpoints

### Backup Management Endpoints

#### Get Invoice Backup History
```
GET /api/tenant/:tenantId/invoices/:invoiceId/backups
```
**Query Parameters:**
- `limit`: Number of backups to return (default: 50)
- `offset`: Number of backups to skip (default: 0)
- `backupType`: Filter by backup type (DRAFT, SAVED, EDIT, POST, FBR_REQUEST, FBR_RESPONSE)

#### Get Invoice Backup Summary
```
GET /api/tenant/:tenantId/invoices/:invoiceId/backup-summary
```

#### Get All Backups
```
GET /api/tenant/:tenantId/backups
```
**Query Parameters:**
- `limit`: Number of backups to return (default: 50)
- `offset`: Number of backups to skip (default: 0)
- `backupType`: Filter by backup type
- `invoiceId`: Filter by specific invoice ID
- `startDate`: Filter by start date
- `endDate`: Filter by end date
- `userId`: Filter by user ID

#### Get Backup Statistics
```
GET /api/tenant/:tenantId/backups/statistics
```
**Query Parameters:**
- `startDate`: Filter by start date
- `endDate`: Filter by end date

#### Export Backups
```
GET /api/tenant/:tenantId/backups/export
```
**Query Parameters:** Same as get all backups
- `format`: Export format (csv, default: csv)

## Setup Instructions

### 1. Database Setup
Run the backup system setup script:
```bash
cd apps/backend
node scripts/setup-backup-system.js
```

This script will:
- Create all necessary backup tables
- Set up indexes for performance
- Insert backup permissions
- Assign permissions to existing roles
- Create database views for easy querying

### 2. Backend Configuration
The backup system is automatically integrated into the existing invoice controllers:
- `invoiceController.js`: Automatically creates backups for all invoice operations
- `InvoiceBackupService.js`: Handles all backup operations
- `invoiceBackupController.js`: Provides backup management endpoints

### 3. Model Integration
The backup models are automatically included in tenant databases:
- `InvoiceBackup`: Main backup table model
- `InvoiceBackupSummary`: Summary table model
- Proper associations with Invoice model

## Usage Examples

### Automatic Backup Creation
The system automatically creates backups for:

1. **Draft Creation/Update**:
   ```javascript
   // When saveInvoice is called
   await InvoiceBackupService.createDraftBackup({
     tenantDb: req.tenantDb,
     tenantModels: req.tenantModels,
     invoice: result,
     invoiceItems: result.InvoiceItems || [],
     isUpdate: !!id,
     user: req.user,
     tenant: req.tenant,
     request: { /* request info */ }
   });
   ```

2. **Saved Invoice Creation/Update**:
   ```javascript
   // When saveAndValidateInvoice is called
   await InvoiceBackupService.createSavedBackup({
     // ... similar parameters
   });
   ```

3. **Invoice Edit**:
   ```javascript
   // When updateInvoice is called
   await InvoiceBackupService.createEditBackup({
     oldInvoice: oldValues,
     newInvoice: updatedInvoice,
     oldInvoiceItems: oldItems,
     newInvoiceItems: newItems,
     // ... other parameters
   });
   ```

4. **FBR API Interactions**:
   ```javascript
   // Before FBR request
   await InvoiceBackupService.createFbrRequestBackup({
     invoice: invoice,
     fbrRequestData: fbrData,
     // ... other parameters
   });

   // After FBR response
   await InvoiceBackupService.createFbrResponseBackup({
     invoice: invoice,
     fbrResponseData: responseData,
     // ... other parameters
   });
   ```

### Manual Backup Operations

#### View Backup History
```javascript
const backups = await InvoiceBackupService.getInvoiceBackupHistory({
  tenantModels: req.tenantModels,
  invoiceId: 123,
  limit: 20,
  backupType: 'EDIT'
});
```

#### Get Backup Summary
```javascript
const summary = await InvoiceBackupService.getInvoiceBackupSummary({
  tenantModels: req.tenantModels,
  invoiceId: 123
});
```

## Backup Types Explained

### DRAFT
- Created when invoices are saved as drafts
- Stores complete draft invoice data
- Includes all form fields and items

### SAVED
- Created when invoices are saved and validated with FBR
- Stores validated invoice data
- Includes FBR validation results

### EDIT
- Created when invoices are updated
- Stores both old and new invoice data
- Allows tracking of all changes made

### POST
- Created when invoices are posted to FBR
- Stores final invoice data before posting
- Includes all items and calculations

### FBR_REQUEST
- Created before sending data to FBR API
- Stores the exact data sent to FBR
- Includes request metadata

### FBR_RESPONSE
- Created after receiving response from FBR API
- Stores the complete FBR response
- Includes success/error information

## Security Considerations

### Access Control
- Only users with `invoice_backup.view` permission can view backups
- Only users with `invoice_backup.export` permission can export backups
- Admin users have full backup access by default
- Backup permissions are role-based

### Data Privacy
- Backup data contains sensitive invoice information
- IP addresses and user agents are logged for security
- All backup operations are logged in audit system
- Data is stored in tenant-specific databases

### Performance
- Backup operations are non-blocking (don't fail main operations)
- Database indexes optimize backup queries
- Pagination prevents large data loads
- Export functionality is rate-limited

## Monitoring and Maintenance

### Backup Monitoring
- Check backup creation logs for errors
- Monitor backup table sizes
- Verify backup integrity periodically
- Track backup creation success rates

### Database Maintenance
```sql
-- Archive old backups (older than 1 year)
INSERT INTO invoice_backups_archive 
SELECT * FROM invoice_backups 
WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 YEAR);

DELETE FROM invoice_backups 
WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 YEAR);

-- Optimize backup tables
OPTIMIZE TABLE invoice_backups;
OPTIMIZE TABLE invoice_backup_summary;
```

### Performance Optimization
```sql
-- Add additional indexes if needed
CREATE INDEX idx_backup_tenant_type_date ON invoice_backups(tenant_id, backup_type, created_at);
CREATE INDEX idx_backup_user_date ON invoice_backups(user_id, created_at);
```

## Troubleshooting

### Common Issues

#### Backups Not Being Created
- Check if backup service is properly imported
- Verify tenant models include backup models
- Check database connection and permissions
- Review error logs for backup failures

#### Performance Issues
- Check database indexes are created
- Monitor backup table sizes
- Consider archiving old backups
- Optimize backup queries

#### Permission Errors
- Verify user has `invoice_backup.view` permission
- Check role assignments in user management
- Ensure admin users have proper access

### Error Handling
The backup system is designed to be non-intrusive:
- Backup failures don't affect main invoice operations
- All backup errors are logged but don't throw exceptions
- System continues to function even if backups fail

## Future Enhancements

### Planned Features
- **Backup Restoration**: Restore invoices from backup data
- **Backup Compression**: Compress old backup data
- **Backup Encryption**: Encrypt sensitive backup data
- **Backup Notifications**: Alert on backup failures
- **Backup Analytics**: Advanced backup usage analytics

### Integration Opportunities
- **Cloud Storage**: Store backups in cloud storage
- **Backup Scheduling**: Automated backup cleanup
- **Backup Verification**: Verify backup data integrity
- **Backup Reporting**: Generate backup reports

## Support

For issues or questions regarding the backup system:
1. Check the troubleshooting section above
2. Review the database setup logs
3. Verify permissions and role assignments
4. Check backup creation logs in console
5. Contact the development team for advanced issues

---

**Note**: This backup system provides comprehensive tracking of all invoice data changes. It operates silently in the background and does not affect the user interface. All backup operations are logged and can be monitored through the audit system.
