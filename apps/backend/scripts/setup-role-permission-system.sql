-- Setup Role and Permission System
-- This script creates the necessary tables and initializes default data

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

-- Add role_id column to users table if it doesn't exist
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE table_name = 'users' 
   AND table_schema = DATABASE() 
   AND column_name = 'role_id') = 0,
  'ALTER TABLE `users` ADD COLUMN `role_id` int(11) DEFAULT NULL AFTER `phone`',
  'SELECT "Column role_id already exists" AS message'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add index for role_id if it doesn't exist
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
   WHERE table_name = 'users' 
   AND table_schema = DATABASE() 
   AND index_name = 'idx_user_role_id') = 0,
  'ALTER TABLE `users` ADD KEY `idx_user_role_id` (`role_id`)',
  'SELECT "Index idx_user_role_id already exists" AS message'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add foreign key constraint for role_id if it doesn't exist
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
   WHERE table_name = 'users' 
   AND table_schema = DATABASE() 
   AND constraint_name = 'fk_users_role') = 0,
  'ALTER TABLE `users` ADD CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE SET NULL',
  'SELECT "Constraint fk_users_role already exists" AS message'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

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
