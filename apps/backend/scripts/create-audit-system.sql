-- Audit System for FBR Invoice Application
-- This script creates comprehensive audit trail tables to track all CRUD operations
-- on invoices, buyers, products, and users by all users in the system

-- Create audit_logs table (master table for all audit entries)
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `entity_type` varchar(50) NOT NULL COMMENT 'Type of entity: invoice, buyer, product, user',
  `entity_id` int(11) NOT NULL COMMENT 'ID of the affected entity',
  `operation` enum('CREATE','UPDATE','DELETE') NOT NULL COMMENT 'Type of operation performed',
  `user_id` int(11) DEFAULT NULL COMMENT 'ID of user who performed the operation',
  `user_email` varchar(255) DEFAULT NULL COMMENT 'Email of user who performed the operation',
  `user_name` varchar(255) DEFAULT NULL COMMENT 'Full name of user who performed the operation',
  `user_role` varchar(50) DEFAULT NULL COMMENT 'Role of user who performed the operation',
  `tenant_id` int(11) DEFAULT NULL COMMENT 'Tenant/Company ID where operation was performed',
  `tenant_name` varchar(255) DEFAULT NULL COMMENT 'Tenant/Company name',
  `old_values` JSON DEFAULT NULL COMMENT 'Previous values before update/delete (JSON format)',
  `new_values` JSON DEFAULT NULL COMMENT 'New values after create/update (JSON format)',
  `changed_fields` JSON DEFAULT NULL COMMENT 'List of fields that were changed (for updates)',
  `ip_address` varchar(45) DEFAULT NULL COMMENT 'IP address of the user',
  `user_agent` text DEFAULT NULL COMMENT 'User agent string from the request',
  `request_id` varchar(100) DEFAULT NULL COMMENT 'Unique request identifier for tracking',
  `additional_info` JSON DEFAULT NULL COMMENT 'Additional context information',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_entity` (`entity_type`, `entity_id`),
  KEY `idx_audit_user` (`user_id`),
  KEY `idx_audit_operation` (`operation`),
  KEY `idx_audit_tenant` (`tenant_id`),
  KEY `idx_audit_created_at` (`created_at`),
  KEY `idx_audit_user_email` (`user_email`),
  KEY `idx_audit_entity_operation` (`entity_type`, `operation`),
  CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_audit_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create audit_summary table for quick admin overview
CREATE TABLE IF NOT EXISTS `audit_summary` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `entity_type` varchar(50) NOT NULL,
  `entity_id` int(11) NOT NULL,
  `entity_name` varchar(255) DEFAULT NULL COMMENT 'Human-readable name of the entity',
  `total_operations` int(11) DEFAULT 0 COMMENT 'Total number of operations on this entity',
  `created_by_user_id` int(11) DEFAULT NULL,
  `created_by_email` varchar(255) DEFAULT NULL,
  `created_by_name` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `last_modified_by_user_id` int(11) DEFAULT NULL,
  `last_modified_by_email` varchar(255) DEFAULT NULL,
  `last_modified_by_name` varchar(255) DEFAULT NULL,
  `last_modified_at` timestamp NULL DEFAULT NULL,
  `tenant_id` int(11) DEFAULT NULL,
  `tenant_name` varchar(255) DEFAULT NULL,
  `is_deleted` tinyint(1) DEFAULT 0 COMMENT 'Whether the entity has been deleted',
  `deleted_by_user_id` int(11) DEFAULT NULL,
  `deleted_by_email` varchar(255) DEFAULT NULL,
  `deleted_by_name` varchar(255) DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_entity` (`entity_type`, `entity_id`),
  KEY `idx_summary_entity_type` (`entity_type`),
  KEY `idx_summary_tenant` (`tenant_id`),
  KEY `idx_summary_created_by` (`created_by_user_id`),
  KEY `idx_summary_last_modified` (`last_modified_by_user_id`),
  KEY `idx_summary_deleted` (`is_deleted`),
  CONSTRAINT `fk_summary_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_summary_last_modified_by` FOREIGN KEY (`last_modified_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_summary_deleted_by` FOREIGN KEY (`deleted_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_summary_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create audit_permissions table to control who can view audit logs
CREATE TABLE IF NOT EXISTS `audit_permissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `permission_name` varchar(100) NOT NULL,
  `display_name` varchar(200) NOT NULL,
  `description` text,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `permission_name` (`permission_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert audit permissions
INSERT IGNORE INTO `audit_permissions` (`permission_name`, `display_name`, `description`) VALUES
('view_audit_logs', 'View Audit Logs', 'View audit trail for all operations'),
('view_audit_summary', 'View Audit Summary', 'View audit summary for entities'),
('export_audit_logs', 'Export Audit Logs', 'Export audit logs to files'),
('view_user_audit', 'View User Audit', 'View audit logs for user management operations'),
('view_invoice_audit', 'View Invoice Audit', 'View audit logs for invoice operations'),
('view_buyer_audit', 'View Buyer Audit', 'View audit logs for buyer operations'),
('view_product_audit', 'View Product Audit', 'View audit logs for product operations');

-- Add audit permissions to existing roles (if they exist)
-- This will add audit permissions to admin role and invoice_creator role
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
CROSS JOIN `audit_permissions` p
WHERE r.name IN ('admin', 'invoice_creator')
AND p.permission_name IN ('view_audit_logs', 'view_audit_summary', 'view_user_audit', 'view_invoice_audit', 'view_buyer_audit', 'view_product_audit');

-- Create additional indexes for better performance
-- Note: These may fail if indexes already exist, which is fine
CREATE INDEX `idx_audit_logs_composite` ON `audit_logs` (`entity_type`, `entity_id`, `created_at`);
CREATE INDEX `idx_audit_logs_user_tenant` ON `audit_logs` (`user_id`, `tenant_id`, `created_at`);
CREATE INDEX `idx_audit_summary_entity_tenant` ON `audit_summary` (`entity_type`, `tenant_id`, `last_modified_at`);

-- Create view for easy audit log querying with user and tenant information
CREATE OR REPLACE VIEW `audit_logs_detailed` AS
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
    t.seller_ntn_cnic as tenant_ntn_cnic
FROM `audit_logs` al
LEFT JOIN `users` u ON al.user_id = u.id
LEFT JOIN `tenants` t ON al.tenant_id = t.id;

-- Create view for audit summary with detailed information
CREATE OR REPLACE VIEW `audit_summary_detailed` AS
SELECT 
    asum.id,
    asum.entity_type,
    asum.entity_id,
    asum.entity_name,
    asum.total_operations,
    asum.created_by_user_id,
    asum.created_by_email,
    asum.created_by_name,
    asum.created_at,
    asum.last_modified_by_user_id,
    asum.last_modified_by_email,
    asum.last_modified_by_name,
    asum.last_modified_at,
    asum.tenant_id,
    asum.tenant_name,
    asum.is_deleted,
    asum.deleted_by_user_id,
    asum.deleted_by_email,
    asum.deleted_by_name,
    asum.deleted_at,
    asum.updated_at,
    u_created.first_name as created_by_first_name,
    u_created.last_name as created_by_last_name,
    u_modified.first_name as last_modified_by_first_name,
    u_modified.last_name as last_modified_by_last_name,
    u_deleted.first_name as deleted_by_first_name,
    u_deleted.last_name as deleted_by_last_name,
    t.seller_business_name as tenant_business_name,
    t.seller_ntn_cnic as tenant_ntn_cnic
FROM `audit_summary` asum
LEFT JOIN `users` u_created ON asum.created_by_user_id = u_created.id
LEFT JOIN `users` u_modified ON asum.last_modified_by_user_id = u_modified.id
LEFT JOIN `users` u_deleted ON asum.deleted_by_user_id = u_deleted.id
LEFT JOIN `tenants` t ON asum.tenant_id = t.id;
