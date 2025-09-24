-- Update audit_logs table to include new operation types
-- This script adds the new invoice operation types to the audit system

-- Update the operation enum to include new invoice operations
ALTER TABLE `audit_logs` 
MODIFY COLUMN `operation` ENUM(
  'CREATE', 
  'UPDATE', 
  'DELETE', 
  'SAVE_DRAFT', 
  'SAVE_AND_VALIDATE', 
  'SUBMIT_TO_FBR', 
  'BULK_CREATE'
) NOT NULL COMMENT 'Type of operation performed';

-- Add comment to document the new operations
ALTER TABLE `audit_logs` 
MODIFY COLUMN `operation` ENUM(
  'CREATE', 
  'UPDATE', 
  'DELETE', 
  'SAVE_DRAFT', 
  'SAVE_AND_VALIDATE', 
  'SUBMIT_TO_FBR', 
  'BULK_CREATE'
) NOT NULL COMMENT 'Type of operation performed: CREATE (new invoice), UPDATE (modify invoice), DELETE (remove invoice), SAVE_DRAFT (save as draft), SAVE_AND_VALIDATE (save and validate with FBR), SUBMIT_TO_FBR (submit to FBR), BULK_CREATE (bulk upload)';

-- Update audit permissions to include invoice-specific permissions
INSERT IGNORE INTO `audit_permissions` (`permission_name`, `display_name`, `description`) VALUES
('view_invoice_audit', 'View Invoice Audit', 'View audit logs for invoice operations'),
('view_bulk_audit', 'View Bulk Operations Audit', 'View audit logs for bulk operations');

-- Add invoice audit permissions to existing roles
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
CROSS JOIN `audit_permissions` p
WHERE r.name IN ('admin', 'invoice_creator')
AND p.permission_name IN ('view_invoice_audit', 'view_bulk_audit');

-- Create index for bulk operations
CREATE INDEX IF NOT EXISTS `idx_audit_bulk_operations` ON `audit_logs` (`operation`, `created_at`) 
WHERE `operation` IN ('BULK_CREATE');

-- Create index for invoice operations
CREATE INDEX IF NOT EXISTS `idx_audit_invoice_operations` ON `audit_logs` (`entity_type`, `operation`, `created_at`) 
WHERE `entity_type` = 'invoice';

-- Update the audit_logs_detailed view to include new operation types
DROP VIEW IF EXISTS `audit_logs_detailed`;
CREATE VIEW `audit_logs_detailed` AS
SELECT 
    al.id,
    al.entity_type,
    al.entity_id,
    al.operation,
    al.user_id,
    al.user_email,
    al.user_name,
    al.user_role,
    al.tenant_id,
    al.tenant_name,
    al.old_values,
    al.new_values,
    al.changed_fields,
    al.ip_address,
    al.user_agent,
    al.request_id,
    al.additional_info,
    al.created_at,
    u.first_name as user_first_name,
    u.last_name as user_last_name,
    u.is_active as user_is_active,
    t.seller_business_name as tenant_business_name,
    t.seller_ntn_cnic as tenant_ntn_cnic,
    -- Add operation description
    CASE 
        WHEN al.operation = 'CREATE' THEN 'Created new invoice'
        WHEN al.operation = 'UPDATE' THEN 'Updated invoice'
        WHEN al.operation = 'DELETE' THEN 'Deleted invoice'
        WHEN al.operation = 'SAVE_DRAFT' THEN 'Saved invoice as draft'
        WHEN al.operation = 'SAVE_AND_VALIDATE' THEN 'Saved and validated invoice'
        WHEN al.operation = 'SUBMIT_TO_FBR' THEN 'Submitted invoice to FBR'
        WHEN al.operation = 'BULK_CREATE' THEN 'Bulk created invoices'
        ELSE al.operation
    END as operation_description
FROM `audit_logs` al
LEFT JOIN `users` u ON al.user_id = u.id
LEFT JOIN `tenants` t ON al.tenant_id = t.id;
