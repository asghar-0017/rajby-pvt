-- Invoice Backup System
-- This script creates comprehensive backup tables to track all invoice data changes
-- including drafts, saved invoices, edits, and FBR API interactions

-- Create invoice_backups table (master table for all invoice backup entries)
CREATE TABLE IF NOT EXISTS `invoice_backups` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `original_invoice_id` int(11) NOT NULL COMMENT 'ID of the original invoice',
  `system_invoice_id` varchar(20) DEFAULT NULL COMMENT 'System invoice ID for reference',
  `invoice_number` varchar(100) DEFAULT NULL COMMENT 'Invoice number at time of backup',
  `backup_type` enum('DRAFT','SAVED','EDIT','POST','FBR_REQUEST','FBR_RESPONSE') NOT NULL COMMENT 'Type of backup operation',
  `backup_reason` varchar(255) DEFAULT NULL COMMENT 'Reason for backup (e.g., "Status change from draft to saved")',
  `status_before` varchar(50) DEFAULT NULL COMMENT 'Invoice status before the operation',
  `status_after` varchar(50) DEFAULT NULL COMMENT 'Invoice status after the operation',
  `invoice_data` JSON NOT NULL COMMENT 'Complete invoice data at time of backup (JSON format)',
  `invoice_items_data` JSON DEFAULT NULL COMMENT 'Complete invoice items data at time of backup (JSON format)',
  `fbr_request_data` JSON DEFAULT NULL COMMENT 'FBR API request data (for POST/FBR_REQUEST types)',
  `fbr_response_data` JSON DEFAULT NULL COMMENT 'FBR API response data (for FBR_RESPONSE type)',
  `fbr_invoice_number` varchar(100) DEFAULT NULL COMMENT 'FBR invoice number if available',
  `user_id` int(11) DEFAULT NULL COMMENT 'ID of user who performed the operation',
  `user_email` varchar(255) DEFAULT NULL COMMENT 'Email of user who performed the operation',
  `user_name` varchar(255) DEFAULT NULL COMMENT 'Full name of user who performed the operation',
  `user_role` varchar(50) DEFAULT NULL COMMENT 'Role of user who performed the operation',
  `tenant_id` int(11) DEFAULT NULL COMMENT 'Tenant/Company ID where operation was performed',
  `tenant_name` varchar(255) DEFAULT NULL COMMENT 'Tenant/Company name',
  `ip_address` varchar(45) DEFAULT NULL COMMENT 'IP address of the user',
  `user_agent` text DEFAULT NULL COMMENT 'User agent string from the request',
  `request_id` varchar(100) DEFAULT NULL COMMENT 'Unique request identifier for tracking',
  `additional_info` JSON DEFAULT NULL COMMENT 'Additional context information',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_backup_original_invoice` (`original_invoice_id`),
  KEY `idx_backup_system_invoice` (`system_invoice_id`),
  KEY `idx_backup_type` (`backup_type`),
  KEY `idx_backup_user` (`user_id`),
  KEY `idx_backup_tenant` (`tenant_id`),
  KEY `idx_backup_created_at` (`created_at`),
  KEY `idx_backup_invoice_number` (`invoice_number`),
  KEY `idx_backup_status_change` (`status_before`, `status_after`),
  KEY `idx_backup_fbr_invoice` (`fbr_invoice_number`),
  CONSTRAINT `fk_backup_original_invoice` FOREIGN KEY (`original_invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_backup_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Invoice backup system for tracking all invoice data changes';

-- Create invoice_backup_summary table for quick overview
CREATE TABLE IF NOT EXISTS `invoice_backup_summary` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `original_invoice_id` int(11) NOT NULL COMMENT 'ID of the original invoice',
  `system_invoice_id` varchar(20) DEFAULT NULL COMMENT 'System invoice ID for reference',
  `current_invoice_number` varchar(100) DEFAULT NULL COMMENT 'Current invoice number',
  `current_status` varchar(50) DEFAULT NULL COMMENT 'Current invoice status',
  `total_backups` int(11) DEFAULT 0 COMMENT 'Total number of backups for this invoice',
  `draft_backups` int(11) DEFAULT 0 COMMENT 'Number of draft backups',
  `saved_backups` int(11) DEFAULT 0 COMMENT 'Number of saved backups',
  `edit_backups` int(11) DEFAULT 0 COMMENT 'Number of edit backups',
  `post_backups` int(11) DEFAULT 0 COMMENT 'Number of post backups',
  `fbr_request_backups` int(11) DEFAULT 0 COMMENT 'Number of FBR request backups',
  `fbr_response_backups` int(11) DEFAULT 0 COMMENT 'Number of FBR response backups',
  `first_backup_at` timestamp NULL DEFAULT NULL COMMENT 'Timestamp of first backup',
  `last_backup_at` timestamp NULL DEFAULT NULL COMMENT 'Timestamp of last backup',
  `created_by_user_id` int(11) DEFAULT NULL COMMENT 'User who created the original invoice',
  `created_by_email` varchar(255) DEFAULT NULL COMMENT 'Email of creator',
  `created_by_name` varchar(255) DEFAULT NULL COMMENT 'Name of creator',
  `tenant_id` int(11) DEFAULT NULL COMMENT 'Tenant/Company ID',
  `tenant_name` varchar(255) DEFAULT NULL COMMENT 'Tenant/Company name',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_invoice_backup_summary` (`original_invoice_id`),
  KEY `idx_backup_summary_system_invoice` (`system_invoice_id`),
  KEY `idx_backup_summary_invoice_number` (`current_invoice_number`),
  KEY `idx_backup_summary_status` (`current_status`),
  KEY `idx_backup_summary_tenant` (`tenant_id`),
  KEY `idx_backup_summary_created_by` (`created_by_user_id`),
  KEY `idx_backup_summary_last_backup` (`last_backup_at`),
  CONSTRAINT `fk_backup_summary_original_invoice` FOREIGN KEY (`original_invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_backup_summary_user` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Summary of invoice backups for quick reference';

-- Create indexes for better performance (MySQL doesn't support IF NOT EXISTS for indexes)
-- These will be created by the model sync, but we can add them manually if needed
-- CREATE INDEX `idx_invoice_backups_composite` ON `invoice_backups` (`original_invoice_id`, `backup_type`, `created_at`);
-- CREATE INDEX `idx_invoice_backups_tenant_type` ON `invoice_backups` (`tenant_id`, `backup_type`, `created_at`);
-- CREATE INDEX `idx_invoice_backups_user_type` ON `invoice_backups` (`user_id`, `backup_type`, `created_at`);

-- Create view for easy backup querying
CREATE OR REPLACE VIEW `invoice_backup_view` AS
SELECT 
  ib.id,
  ib.original_invoice_id,
  ib.system_invoice_id,
  ib.invoice_number,
  ib.backup_type,
  ib.backup_reason,
  ib.status_before,
  ib.status_after,
  ib.fbr_invoice_number,
  ib.user_id,
  ib.user_email,
  ib.user_name,
  ib.user_role,
  ib.tenant_id,
  ib.tenant_name,
  ib.created_at,
  ibs.current_invoice_number as current_invoice_number,
  ibs.current_status as current_status,
  ibs.total_backups,
  CASE 
    WHEN ib.backup_type = 'DRAFT' THEN 'Draft Backup'
    WHEN ib.backup_type = 'SAVED' THEN 'Saved Backup'
    WHEN ib.backup_type = 'EDIT' THEN 'Edit Backup'
    WHEN ib.backup_type = 'POST' THEN 'Post Backup'
    WHEN ib.backup_type = 'FBR_REQUEST' THEN 'FBR Request Backup'
    WHEN ib.backup_type = 'FBR_RESPONSE' THEN 'FBR Response Backup'
    ELSE 'Unknown Backup'
  END as backup_type_display
FROM `invoice_backups` ib
LEFT JOIN `invoice_backup_summary` ibs ON ib.original_invoice_id = ibs.original_invoice_id
ORDER BY ib.created_at DESC;

-- Insert backup system permissions
INSERT IGNORE INTO `permissions` (`permission_name`, `display_name`, `description`, `is_active`) VALUES
('invoice_backup.view', 'View Invoice Backups', 'View invoice backup data and history', 1),
('invoice_backup.export', 'Export Invoice Backups', 'Export invoice backup data', 1),
('invoice_backup.restore', 'Restore Invoice Backups', 'Restore invoice from backup data', 1);

-- Assign backup permissions to admin role
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id 
FROM `roles` r, `permissions` p 
WHERE r.role_name = 'admin' 
AND p.permission_name IN ('invoice_backup.view', 'invoice_backup.export', 'invoice_backup.restore');

-- Assign view permission to manager role
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id 
FROM `roles` r, `permissions` p 
WHERE r.role_name = 'manager' 
AND p.permission_name = 'invoice_backup.view';
