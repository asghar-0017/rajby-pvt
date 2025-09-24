-- =====================================================
-- COMPLETE AUDIT & USER MANAGEMENT SYSTEM SETUP
-- =====================================================
-- This script creates a comprehensive audit system and user management
-- with roles and permissions for the FBR Invoice Application
-- =====================================================

-- =====================================================
-- 1. CREATE USER MANAGEMENT TABLES
-- =====================================================

-- Create users table
CREATE TABLE IF NOT EXISTS `users` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `email` varchar(255) NOT NULL,
    `password` varchar(255) NOT NULL,
    `first_name` varchar(100) NOT NULL,
    `last_name` varchar(100) NOT NULL,
    `phone` varchar(20) DEFAULT NULL,
    `role_id` int(11) DEFAULT NULL,
    `is_active` tinyint(1) DEFAULT 1,
    `is_verified` tinyint(1) DEFAULT 0,
    `verify_token` varchar(255) DEFAULT NULL,
    `reset_token` varchar(255) DEFAULT NULL,
    `reset_token_expiry` datetime DEFAULT NULL,
    `created_by` int(11) DEFAULT NULL,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `email` (`email`),
    KEY `idx_user_email` (`email`),
    KEY `idx_user_role_id` (`role_id`),
    KEY `idx_user_active` (`is_active`),
    KEY `idx_user_created_by` (`created_by`),
    CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_users_created_by` FOREIGN KEY (`created_by`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create user_tenant_assignments table
CREATE TABLE IF NOT EXISTS `user_tenant_assignments` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `user_id` int(11) NOT NULL,
    `tenant_id` int(11) NOT NULL,
    `is_active` tinyint(1) DEFAULT 1,
    `assigned_by` int(11) DEFAULT NULL,
    `assigned_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_user_tenant` (`user_id`, `tenant_id`),
    KEY `idx_user_tenant_user` (`user_id`),
    KEY `idx_user_tenant_tenant` (`tenant_id`),
    KEY `idx_user_tenant_active` (`is_active`),
    KEY `idx_user_tenant_assigned_by` (`assigned_by`),
    CONSTRAINT `fk_user_tenant_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_user_tenant_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_user_tenant_assigned_by` FOREIGN KEY (`assigned_by`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 2. CREATE ROLE & PERMISSION SYSTEM
-- =====================================================

-- Create roles table
CREATE TABLE IF NOT EXISTS `roles` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `name` varchar(50) NOT NULL,
    `display_name` varchar(100) NOT NULL,
    `description` text,
    `is_system_role` tinyint(1) DEFAULT 0,
    `is_active` tinyint(1) DEFAULT 1,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `name` (`name`),
    KEY `idx_roles_name` (`name`),
    KEY `idx_roles_system` (`is_system_role`),
    KEY `idx_roles_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create permissions table
CREATE TABLE IF NOT EXISTS `permissions` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `name` varchar(100) NOT NULL,
    `display_name` varchar(200) NOT NULL,
    `description` text,
    `category` varchar(50) NOT NULL,
    `is_active` tinyint(1) DEFAULT 1,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `name` (`name`),
    KEY `idx_permissions_name` (`name`),
    KEY `idx_permissions_category` (`category`),
    KEY `idx_permissions_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create role_permissions junction table
CREATE TABLE IF NOT EXISTS `role_permissions` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `role_id` int(11) NOT NULL,
    `permission_id` int(11) NOT NULL,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `role_permission` (`role_id`, `permission_id`),
    KEY `idx_role_permissions_role` (`role_id`),
    KEY `idx_role_permissions_permission` (`permission_id`),
    CONSTRAINT `fk_role_permissions_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_role_permissions_permission` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 3. CREATE AUDIT SYSTEM
-- =====================================================

-- Create audit_logs table (master table for all audit entries)
CREATE TABLE IF NOT EXISTS `audit_logs` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `entity_type` varchar(50) NOT NULL COMMENT 'Type of entity: invoice, buyer, product, user',
    `entity_id` int(11) NOT NULL COMMENT 'ID of the affected entity',
    `operation` enum('CREATE','UPDATE','DELETE','SAVE_DRAFT','SAVE_AND_VALIDATE','SUBMIT_TO_FBR','BULK_CREATE') NOT NULL COMMENT 'Type of operation performed',
    `user_id` int(11) DEFAULT NULL COMMENT 'ID of user who performed the operation',
    `user_email` varchar(255) DEFAULT NULL COMMENT 'Email of user who performed the operation',
    `user_name` varchar(255) DEFAULT NULL COMMENT 'Full name of user who performed the operation',
    `user_role` varchar(50) DEFAULT NULL COMMENT 'Role of user who performed the operation',
    `tenant_id` int(11) DEFAULT NULL COMMENT 'Tenant/Company ID where operation was performed',
    `tenant_name` varchar(255) DEFAULT NULL COMMENT 'Tenant/Company name',
    `old_values` json DEFAULT NULL COMMENT 'Previous values before update/delete (JSON format)',
    `new_values` json DEFAULT NULL COMMENT 'New values after create/update (JSON format)',
    `changed_fields` json DEFAULT NULL COMMENT 'List of fields that were changed (for updates)',
    `ip_address` varchar(45) DEFAULT NULL COMMENT 'IP address of the user',
    `user_agent` text DEFAULT NULL COMMENT 'User agent string from the request',
    `request_id` varchar(100) DEFAULT NULL COMMENT 'Unique request identifier for tracking',
    `additional_info` json DEFAULT NULL COMMENT 'Additional context information',
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_audit_entity` (`entity_type`, `entity_id`),
    KEY `idx_audit_user` (`user_id`),
    KEY `idx_audit_operation` (`operation`),
    KEY `idx_audit_tenant` (`tenant_id`),
    KEY `idx_audit_created_at` (`created_at`),
    KEY `idx_audit_user_email` (`user_email`),
    KEY `idx_audit_entity_operation` (`entity_type`, `operation`),
    KEY `idx_audit_bulk_operations` (`operation`, `created_at`),
    KEY `idx_audit_invoice_operations` (`entity_type`, `operation`, `created_at`),
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

-- =====================================================
-- 4. INSERT DEFAULT DATA
-- =====================================================

-- Insert default roles
INSERT IGNORE INTO `roles` (`name`, `display_name`, `description`, `is_system_role`) VALUES
('admin', 'Administrator', 'Full system access with all permissions', 1),
('invoice_creator', 'Invoice Creator', 'Can create, edit, and manage invoices', 1),
('buyer_manager', 'Buyer Manager', 'Can manage buyers and buyer-related operations', 1),
('product_manager', 'Product Manager', 'Can manage products and product-related operations', 1),
('viewer', 'Viewer', 'Read-only access to view data', 1);

-- Insert default permissions
INSERT IGNORE INTO `permissions` (`name`, `display_name`, `description`, `category`) VALUES
-- User Management
('create_user', 'Create User', 'Create new users', 'User Management'),
('read_user', 'Read User', 'View user information', 'User Management'),
('update_user', 'Update User', 'Update user information', 'User Management'),
('delete_user', 'Delete User', 'Delete users', 'User Management'),

-- Role Management
('create_role', 'Create Role', 'Create new roles', 'Role Management'),
('read_role', 'Read Role', 'View role information', 'Role Management'),
('update_role', 'Update Role', 'Update role information', 'Role Management'),
('delete_role', 'Delete Role', 'Delete roles', 'Role Management'),

-- Invoice Management
('create_invoice', 'Create Invoice', 'Create new invoices', 'Invoice Management'),
('read_invoice', 'Read Invoice', 'View invoice information', 'Invoice Management'),
('update_invoice', 'Update Invoice', 'Update invoice information', 'Invoice Management'),
('delete_invoice', 'Delete Invoice', 'Delete invoices', 'Invoice Management'),
('invoice_uploader', 'Invoice Uploader', 'Upload invoices', 'Invoice Management'),
('invoice_validate', 'Invoice Validate', 'Validate invoices', 'Invoice Management'),
('invoice_save', 'Invoice Save', 'Save invoices', 'Invoice Management'),

-- Buyer Management
('create_buyer', 'Create Buyer', 'Create new buyers', 'Buyer Management'),
('read_buyer', 'Read Buyer', 'View buyer information', 'Buyer Management'),
('update_buyer', 'Update Buyer', 'Update buyer information', 'Buyer Management'),
('delete_buyer', 'Delete Buyer', 'Delete buyers', 'Buyer Management'),
('buyer_uploader', 'Buyer Uploader', 'Upload buyers', 'Buyer Management'),

-- Product Management
('create_product', 'Create Product', 'Create new products', 'Product Management'),
('read_product', 'Read Product', 'View product information', 'Product Management'),
('update_product', 'Update Product', 'Update product information', 'Product Management'),
('delete_product', 'Delete Product', 'Delete products', 'Product Management'),
('product_uploader', 'Product Uploader', 'Upload products', 'Product Management'),

-- Dashboard & Reports
('view_dashboard', 'View Dashboard', 'View dashboard and overview', 'Dashboard'),
('report_view', 'Report View', 'View reports', 'Report Management');

-- Insert audit permissions
INSERT IGNORE INTO `audit_permissions` (`permission_name`, `display_name`, `description`) VALUES
('view_audit_logs', 'View Audit Logs', 'View audit trail for all operations'),
('view_audit_summary', 'View Audit Summary', 'View audit summary for entities'),
('export_audit_logs', 'Export Audit Logs', 'Export audit logs to files'),
('view_user_audit', 'View User Audit', 'View audit logs for user management operations'),
('view_invoice_audit', 'View Invoice Audit', 'View audit logs for invoice operations'),
('view_buyer_audit', 'View Buyer Audit', 'View audit logs for buyer operations'),
('view_product_audit', 'View Product Audit', 'View audit logs for product operations'),
('view_bulk_audit', 'View Bulk Operations Audit', 'View audit logs for bulk operations');

-- =====================================================
-- 5. ASSIGN PERMISSIONS TO ROLES
-- =====================================================

-- Assign all permissions to admin role
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.name = 'admin';

-- Assign audit permissions to admin role
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, ap.id
FROM `roles` r
CROSS JOIN `audit_permissions` ap
WHERE r.name = 'admin';

-- Assign invoice-related permissions to invoice_creator role
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.name = 'invoice_creator'
AND p.name IN (
    'create_invoice', 'read_invoice', 'update_invoice', 'delete_invoice',
    'invoice_uploader', 'invoice_validate', 'invoice_save',
    'view_dashboard', 'report_view'
);

-- Assign audit permissions to invoice_creator role
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, ap.id
FROM `roles` r
CROSS JOIN `audit_permissions` ap
WHERE r.name = 'invoice_creator'
AND ap.permission_name IN ('view_invoice_audit', 'view_bulk_audit');

-- Assign buyer-related permissions to buyer_manager role
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.name = 'buyer_manager'
AND p.name IN (
    'create_buyer', 'read_buyer', 'update_buyer', 'delete_buyer',
    'buyer_uploader', 'view_dashboard', 'report_view'
);

-- Assign audit permissions to buyer_manager role
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, ap.id
FROM `roles` r
CROSS JOIN `audit_permissions` ap
WHERE r.name = 'buyer_manager'
AND ap.permission_name IN ('view_buyer_audit');

-- Assign product-related permissions to product_manager role
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.name = 'product_manager'
AND p.name IN (
    'create_product', 'read_product', 'update_product', 'delete_product',
    'product_uploader', 'view_dashboard', 'report_view'
);

-- Assign audit permissions to product_manager role
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, ap.id
FROM `roles` r
CROSS JOIN `audit_permissions` ap
WHERE r.name = 'product_manager'
AND ap.permission_name IN ('view_product_audit');

-- Assign read-only permissions to viewer role
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.name = 'viewer'
AND p.name IN (
    'read_invoice', 'read_buyer', 'read_product', 'read_user',
    'view_dashboard', 'report_view'
);

-- =====================================================
-- 6. CREATE PERFORMANCE INDEXES
-- =====================================================

-- Create additional indexes for better performance
CREATE INDEX IF NOT EXISTS `idx_audit_logs_composite` ON `audit_logs` (`entity_type`, `entity_id`, `created_at`);
CREATE INDEX IF NOT EXISTS `idx_audit_logs_user_tenant` ON `audit_logs` (`user_id`, `tenant_id`, `created_at`);
CREATE INDEX IF NOT EXISTS `idx_audit_summary_entity_tenant` ON `audit_summary` (`entity_type`, `tenant_id`, `last_modified_at`);

-- =====================================================
-- 7. CREATE VIEWS FOR EASY QUERYING
-- =====================================================

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

-- Create view for user permissions (combines user, role, and permissions)
CREATE OR REPLACE VIEW `user_permissions_view` AS
SELECT 
    u.id as user_id,
    u.email,
    u.first_name,
    u.last_name,
    u.is_active as user_active,
    r.id as role_id,
    r.name as role_name,
    r.display_name as role_display_name,
    p.id as permission_id,
    p.name as permission_name,
    p.display_name as permission_display_name,
    p.category as permission_category
FROM `users` u
LEFT JOIN `roles` r ON u.role_id = r.id
LEFT JOIN `role_permissions` rp ON r.id = rp.role_id
LEFT JOIN `permissions` p ON rp.permission_id = p.id
WHERE u.is_active = 1 AND r.is_active = 1 AND p.is_active = 1;

-- =====================================================
-- 8. CREATE STORED PROCEDURES FOR AUDIT OPERATIONS
-- =====================================================

DELIMITER //

-- Procedure to log audit entries
CREATE PROCEDURE IF NOT EXISTS `LogAuditEntry`(
    IN p_entity_type VARCHAR(50),
    IN p_entity_id INT,
    IN p_operation ENUM('CREATE','UPDATE','DELETE','SAVE_DRAFT','SAVE_AND_VALIDATE','SUBMIT_TO_FBR','BULK_CREATE'),
    IN p_user_id INT,
    IN p_user_email VARCHAR(255),
    IN p_user_name VARCHAR(255),
    IN p_user_role VARCHAR(50),
    IN p_tenant_id INT,
    IN p_tenant_name VARCHAR(255),
    IN p_old_values JSON,
    IN p_new_values JSON,
    IN p_changed_fields JSON,
    IN p_ip_address VARCHAR(45),
    IN p_user_agent TEXT,
    IN p_request_id VARCHAR(100),
    IN p_additional_info JSON
)
BEGIN
    INSERT INTO `audit_logs` (
        `entity_type`, `entity_id`, `operation`, `user_id`, `user_email`, `user_name`, `user_role`,
        `tenant_id`, `tenant_name`, `old_values`, `new_values`, `changed_fields`,
        `ip_address`, `user_agent`, `request_id`, `additional_info`
    ) VALUES (
        p_entity_type, p_entity_id, p_operation, p_user_id, p_user_email, p_user_name, p_user_role,
        p_tenant_id, p_tenant_name, p_old_values, p_new_values, p_changed_fields,
        p_ip_address, p_user_agent, p_request_id, p_additional_info
    );
END //

-- Procedure to update audit summary
CREATE PROCEDURE IF NOT EXISTS `UpdateAuditSummary`(
    IN p_entity_type VARCHAR(50),
    IN p_entity_id INT,
    IN p_entity_name VARCHAR(255),
    IN p_operation ENUM('CREATE','UPDATE','DELETE','SAVE_DRAFT','SAVE_AND_VALIDATE','SUBMIT_TO_FBR','BULK_CREATE'),
    IN p_user_id INT,
    IN p_user_email VARCHAR(255),
    IN p_user_name VARCHAR(255),
    IN p_tenant_id INT,
    IN p_tenant_name VARCHAR(255)
)
BEGIN
    INSERT INTO `audit_summary` (
        `entity_type`, `entity_id`, `entity_name`, `total_operations`,
        `created_by_user_id`, `created_by_email`, `created_by_name`, `created_at`,
        `last_modified_by_user_id`, `last_modified_by_email`, `last_modified_by_name`, `last_modified_at`,
        `tenant_id`, `tenant_name`, `is_deleted`, `deleted_by_user_id`, `deleted_by_email`, `deleted_by_name`, `deleted_at`
    ) VALUES (
        p_entity_type, p_entity_id, p_entity_name, 1,
        p_user_id, p_user_email, p_user_name, NOW(),
        p_user_id, p_user_email, p_user_name, NOW(),
        p_tenant_id, p_tenant_name, 0, NULL, NULL, NULL, NULL
    )
    ON DUPLICATE KEY UPDATE
        `total_operations` = `total_operations` + 1,
        `last_modified_by_user_id` = p_user_id,
        `last_modified_by_email` = p_user_email,
        `last_modified_by_name` = p_user_name,
        `last_modified_at` = NOW(),
        `is_deleted` = CASE WHEN p_operation = 'DELETE' THEN 1 ELSE `is_deleted` END,
        `deleted_by_user_id` = CASE WHEN p_operation = 'DELETE' THEN p_user_id ELSE `deleted_by_user_id` END,
        `deleted_by_email` = CASE WHEN p_operation = 'DELETE' THEN p_user_email ELSE `deleted_by_email` END,
        `deleted_by_name` = CASE WHEN p_operation = 'DELETE' THEN p_user_name ELSE `deleted_by_name` END,
        `deleted_at` = CASE WHEN p_operation = 'DELETE' THEN NOW() ELSE `deleted_at` END;
END //

DELIMITER ;

-- =====================================================
-- 9. CREATE TRIGGERS FOR AUTOMATIC AUDIT LOGGING
-- =====================================================

-- Note: These triggers will automatically log audit entries when data changes
-- You may need to adjust the trigger logic based on your specific requirements

-- Example trigger for users table (uncomment and modify as needed)
/*
DELIMITER //
CREATE TRIGGER `users_audit_insert` AFTER INSERT ON `users`
FOR EACH ROW
BEGIN
    CALL LogAuditEntry(
        'user', NEW.id, 'CREATE', 
        NEW.created_by, NULL, NULL, NULL,
        NULL, NULL, NULL, JSON_OBJECT('id', NEW.id, 'email', NEW.email, 'first_name', NEW.first_name, 'last_name', NEW.last_name),
        NULL, NULL, NULL, NULL, NULL
    );
    
    CALL UpdateAuditSummary(
        'user', NEW.id, CONCAT(NEW.first_name, ' ', NEW.last_name), 'CREATE',
        NEW.created_by, NULL, NULL, NULL, NULL
    );
END //

CREATE TRIGGER `users_audit_update` AFTER UPDATE ON `users`
FOR EACH ROW
BEGIN
    DECLARE changed_fields JSON DEFAULT JSON_ARRAY();
    
    -- Build changed fields array
    IF OLD.email != NEW.email THEN SET changed_fields = JSON_ARRAY_APPEND(changed_fields, '$', 'email'); END IF;
    IF OLD.first_name != NEW.first_name THEN SET changed_fields = JSON_ARRAY_APPEND(changed_fields, '$', 'first_name'); END IF;
    IF OLD.last_name != NEW.last_name THEN SET changed_fields = JSON_ARRAY_APPEND(changed_fields, '$', 'last_name'); END IF;
    IF OLD.is_active != NEW.is_active THEN SET changed_fields = JSON_ARRAY_APPEND(changed_fields, '$', 'is_active'); END IF;
    
    IF JSON_LENGTH(changed_fields) > 0 THEN
        CALL LogAuditEntry(
            'user', NEW.id, 'UPDATE', 
            NEW.created_by, NULL, NULL, NULL,
            NULL, NULL, 
            JSON_OBJECT('id', OLD.id, 'email', OLD.email, 'first_name', OLD.first_name, 'last_name', OLD.last_name, 'is_active', OLD.is_active),
            JSON_OBJECT('id', NEW.id, 'email', NEW.email, 'first_name', NEW.first_name, 'last_name', NEW.last_name, 'is_active', NEW.is_active),
            changed_fields, NULL, NULL, NULL, NULL
        );
        
        CALL UpdateAuditSummary(
            'user', NEW.id, CONCAT(NEW.first_name, ' ', NEW.last_name), 'UPDATE',
            NEW.created_by, NULL, NULL, NULL, NULL
        );
    END IF;
END //

CREATE TRIGGER `users_audit_delete` AFTER DELETE ON `users`
FOR EACH ROW
BEGIN
    CALL LogAuditEntry(
        'user', OLD.id, 'DELETE', 
        OLD.created_by, NULL, NULL, NULL,
        NULL, NULL, 
        JSON_OBJECT('id', OLD.id, 'email', OLD.email, 'first_name', OLD.first_name, 'last_name', OLD.last_name),
        NULL, NULL, NULL, NULL, NULL, NULL
    );
    
    CALL UpdateAuditSummary(
        'user', OLD.id, CONCAT(OLD.first_name, ' ', OLD.last_name), 'DELETE',
        OLD.created_by, NULL, NULL, NULL, NULL
    );
END //
DELIMITER ;
*/

-- =====================================================
-- SETUP COMPLETE
-- =====================================================

-- Display summary of created tables and data
SELECT 'AUDIT & USER MANAGEMENT SYSTEM SETUP COMPLETE' as status;

SELECT 'Tables Created:' as info;
SELECT TABLE_NAME as table_name, TABLE_ROWS as estimated_rows 
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME IN ('users', 'user_tenant_assignments', 'roles', 'permissions', 'role_permissions', 'audit_logs', 'audit_summary', 'audit_permissions')
ORDER BY TABLE_NAME;

SELECT 'Roles Created:' as info;
SELECT name, display_name, description FROM roles ORDER BY name;

SELECT 'Permissions Created:' as info;
SELECT COUNT(*) as total_permissions FROM permissions;

SELECT 'Audit Permissions Created:' as info;
SELECT COUNT(*) as total_audit_permissions FROM audit_permissions;

SELECT 'Role-Permission Assignments:' as info;
SELECT r.name as role_name, COUNT(rp.permission_id) as permission_count 
FROM roles r 
LEFT JOIN role_permissions rp ON r.id = rp.role_id 
GROUP BY r.id, r.name 
ORDER BY r.name;
