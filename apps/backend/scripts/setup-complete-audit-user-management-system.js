const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

/**
 * Complete Audit & User Management System Setup
 * This script creates a comprehensive audit system and user management
 * with roles and permissions for the FBR Invoice Application
 */

class AuditUserManagementSetup {
    constructor() {
        this.connection = null;
        this.setupLog = [];
    }

    async connect() {
        try {
            // Database connection configuration
            this.connection = await mysql.createConnection({
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || 'fbr_diamondindustries',
                charset: 'utf8mb4'
            });

            this.log('Connected to database successfully');
        } catch (error) {
            this.log(`Database connection failed: ${error.message}`, 'ERROR');
            throw error;
        }
    }

    async disconnect() {
        if (this.connection) {
            await this.connection.end();
            this.log('Database connection closed');
        }
    }

    log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level}] ${message}`;
        console.log(logEntry);
        this.setupLog.push(logEntry);
    }

    async executeQuery(query, params = []) {
        try {
            const [results] = await this.connection.execute(query, params);
            return results;
        } catch (error) {
            this.log(`Query execution failed: ${error.message}`, 'ERROR');
            this.log(`Query: ${query}`, 'ERROR');
            throw error;
        }
    }

    async executeFile(filePath) {
        try {
            const sqlContent = fs.readFileSync(filePath, 'utf8');
            const queries = sqlContent.split(';').filter(query => query.trim());
            
            for (const query of queries) {
                if (query.trim()) {
                    await this.executeQuery(query);
                }
            }
            
            this.log(`Executed SQL file: ${filePath}`);
        } catch (error) {
            this.log(`Failed to execute SQL file ${filePath}: ${error.message}`, 'ERROR');
            throw error;
        }
    }

    async createTables() {
        this.log('Creating user management tables...');
        
        // Create users table
        await this.executeQuery(`
            CREATE TABLE IF NOT EXISTS \`users\` (
                \`id\` int(11) NOT NULL AUTO_INCREMENT,
                \`email\` varchar(255) NOT NULL,
                \`password\` varchar(255) NOT NULL,
                \`first_name\` varchar(100) NOT NULL,
                \`last_name\` varchar(100) NOT NULL,
                \`phone\` varchar(20) DEFAULT NULL,
                \`role_id\` int(11) DEFAULT NULL,
                \`is_active\` tinyint(1) DEFAULT 1,
                \`is_verified\` tinyint(1) DEFAULT 0,
                \`verify_token\` varchar(255) DEFAULT NULL,
                \`reset_token\` varchar(255) DEFAULT NULL,
                \`reset_token_expiry\` datetime DEFAULT NULL,
                \`created_by\` int(11) DEFAULT NULL,
                \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (\`id\`),
                UNIQUE KEY \`email\` (\`email\`),
                KEY \`idx_user_email\` (\`email\`),
                KEY \`idx_user_role_id\` (\`role_id\`),
                KEY \`idx_user_active\` (\`is_active\`),
                KEY \`idx_user_created_by\` (\`created_by\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Create user_tenant_assignments table
        await this.executeQuery(`
            CREATE TABLE IF NOT EXISTS \`user_tenant_assignments\` (
                \`id\` int(11) NOT NULL AUTO_INCREMENT,
                \`user_id\` int(11) NOT NULL,
                \`tenant_id\` int(11) NOT NULL,
                \`is_active\` tinyint(1) DEFAULT 1,
                \`assigned_by\` int(11) DEFAULT NULL,
                \`assigned_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (\`id\`),
                UNIQUE KEY \`unique_user_tenant\` (\`user_id\`, \`tenant_id\`),
                KEY \`idx_user_tenant_user\` (\`user_id\`),
                KEY \`idx_user_tenant_tenant\` (\`tenant_id\`),
                KEY \`idx_user_tenant_active\` (\`is_active\`),
                KEY \`idx_user_tenant_assigned_by\` (\`assigned_by\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Create roles table
        await this.executeQuery(`
            CREATE TABLE IF NOT EXISTS \`roles\` (
                \`id\` int(11) NOT NULL AUTO_INCREMENT,
                \`name\` varchar(50) NOT NULL,
                \`display_name\` varchar(100) NOT NULL,
                \`description\` text,
                \`is_system_role\` tinyint(1) DEFAULT 0,
                \`is_active\` tinyint(1) DEFAULT 1,
                \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (\`id\`),
                UNIQUE KEY \`name\` (\`name\`),
                KEY \`idx_roles_name\` (\`name\`),
                KEY \`idx_roles_system\` (\`is_system_role\`),
                KEY \`idx_roles_active\` (\`is_active\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Create permissions table
        await this.executeQuery(`
            CREATE TABLE IF NOT EXISTS \`permissions\` (
                \`id\` int(11) NOT NULL AUTO_INCREMENT,
                \`name\` varchar(100) NOT NULL,
                \`display_name\` varchar(200) NOT NULL,
                \`description\` text,
                \`category\` varchar(50) NOT NULL,
                \`is_active\` tinyint(1) DEFAULT 1,
                \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (\`id\`),
                UNIQUE KEY \`name\` (\`name\`),
                KEY \`idx_permissions_name\` (\`name\`),
                KEY \`idx_permissions_category\` (\`category\`),
                KEY \`idx_permissions_active\` (\`is_active\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Create role_permissions table
        await this.executeQuery(`
            CREATE TABLE IF NOT EXISTS \`role_permissions\` (
                \`id\` int(11) NOT NULL AUTO_INCREMENT,
                \`role_id\` int(11) NOT NULL,
                \`permission_id\` int(11) NOT NULL,
                \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (\`id\`),
                UNIQUE KEY \`role_permission\` (\`role_id\`, \`permission_id\`),
                KEY \`idx_role_permissions_role\` (\`role_id\`),
                KEY \`idx_role_permissions_permission\` (\`permission_id\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Create audit_logs table
        await this.executeQuery(`
            CREATE TABLE IF NOT EXISTS \`audit_logs\` (
                \`id\` int(11) NOT NULL AUTO_INCREMENT,
                \`entity_type\` varchar(50) NOT NULL COMMENT 'Type of entity: invoice, buyer, product, user',
                \`entity_id\` int(11) NOT NULL COMMENT 'ID of the affected entity',
                \`operation\` enum('CREATE','UPDATE','DELETE','SAVE_DRAFT','SAVE_AND_VALIDATE','SUBMIT_TO_FBR','BULK_CREATE') NOT NULL COMMENT 'Type of operation performed',
                \`user_id\` int(11) DEFAULT NULL COMMENT 'ID of user who performed the operation',
                \`user_email\` varchar(255) DEFAULT NULL COMMENT 'Email of user who performed the operation',
                \`user_name\` varchar(255) DEFAULT NULL COMMENT 'Full name of user who performed the operation',
                \`user_role\` varchar(50) DEFAULT NULL COMMENT 'Role of user who performed the operation',
                \`tenant_id\` int(11) DEFAULT NULL COMMENT 'Tenant/Company ID where operation was performed',
                \`tenant_name\` varchar(255) DEFAULT NULL COMMENT 'Tenant/Company name',
                \`old_values\` json DEFAULT NULL COMMENT 'Previous values before update/delete (JSON format)',
                \`new_values\` json DEFAULT NULL COMMENT 'New values after create/update (JSON format)',
                \`changed_fields\` json DEFAULT NULL COMMENT 'List of fields that were changed (for updates)',
                \`ip_address\` varchar(45) DEFAULT NULL COMMENT 'IP address of the user',
                \`user_agent\` text DEFAULT NULL COMMENT 'User agent string from the request',
                \`request_id\` varchar(100) DEFAULT NULL COMMENT 'Unique request identifier for tracking',
                \`additional_info\` json DEFAULT NULL COMMENT 'Additional context information',
                \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (\`id\`),
                KEY \`idx_audit_entity\` (\`entity_type\`, \`entity_id\`),
                KEY \`idx_audit_user\` (\`user_id\`),
                KEY \`idx_audit_operation\` (\`operation\`),
                KEY \`idx_audit_tenant\` (\`tenant_id\`),
                KEY \`idx_audit_created_at\` (\`created_at\`),
                KEY \`idx_audit_user_email\` (\`user_email\`),
                KEY \`idx_audit_entity_operation\` (\`entity_type\`, \`operation\`),
                KEY \`idx_audit_bulk_operations\` (\`operation\`, \`created_at\`),
                KEY \`idx_audit_invoice_operations\` (\`entity_type\`, \`operation\`, \`created_at\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Create audit_summary table
        await this.executeQuery(`
            CREATE TABLE IF NOT EXISTS \`audit_summary\` (
                \`id\` int(11) NOT NULL AUTO_INCREMENT,
                \`entity_type\` varchar(50) NOT NULL,
                \`entity_id\` int(11) NOT NULL,
                \`entity_name\` varchar(255) DEFAULT NULL COMMENT 'Human-readable name of the entity',
                \`total_operations\` int(11) DEFAULT 0 COMMENT 'Total number of operations on this entity',
                \`created_by_user_id\` int(11) DEFAULT NULL,
                \`created_by_email\` varchar(255) DEFAULT NULL,
                \`created_by_name\` varchar(255) DEFAULT NULL,
                \`created_at\` timestamp NULL DEFAULT NULL,
                \`last_modified_by_user_id\` int(11) DEFAULT NULL,
                \`last_modified_by_email\` varchar(255) DEFAULT NULL,
                \`last_modified_by_name\` varchar(255) DEFAULT NULL,
                \`last_modified_at\` timestamp NULL DEFAULT NULL,
                \`tenant_id\` int(11) DEFAULT NULL,
                \`tenant_name\` varchar(255) DEFAULT NULL,
                \`is_deleted\` tinyint(1) DEFAULT 0 COMMENT 'Whether the entity has been deleted',
                \`deleted_by_user_id\` int(11) DEFAULT NULL,
                \`deleted_by_email\` varchar(255) DEFAULT NULL,
                \`deleted_by_name\` varchar(255) DEFAULT NULL,
                \`deleted_at\` timestamp NULL DEFAULT NULL,
                \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (\`id\`),
                UNIQUE KEY \`unique_entity\` (\`entity_type\`, \`entity_id\`),
                KEY \`idx_summary_entity_type\` (\`entity_type\`),
                KEY \`idx_summary_tenant\` (\`tenant_id\`),
                KEY \`idx_summary_created_by\` (\`created_by_user_id\`),
                KEY \`idx_summary_last_modified\` (\`last_modified_by_user_id\`),
                KEY \`idx_summary_deleted\` (\`is_deleted\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Create audit_permissions table
        await this.executeQuery(`
            CREATE TABLE IF NOT EXISTS \`audit_permissions\` (
                \`id\` int(11) NOT NULL AUTO_INCREMENT,
                \`permission_name\` varchar(100) NOT NULL,
                \`display_name\` varchar(200) NOT NULL,
                \`description\` text,
                \`is_active\` tinyint(1) DEFAULT 1,
                \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (\`id\`),
                UNIQUE KEY \`permission_name\` (\`permission_name\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        this.log('All tables created successfully');
    }

    async addForeignKeys() {
        this.log('Adding foreign key constraints...');

        const foreignKeys = [
            {
                table: 'users',
                constraint: 'fk_users_role',
                key: 'role_id',
                references: 'roles(id)',
                onDelete: 'SET NULL'
            },
            {
                table: 'users',
                constraint: 'fk_users_created_by',
                key: 'created_by',
                references: 'admin_users(id)',
                onDelete: 'SET NULL'
            },
            {
                table: 'user_tenant_assignments',
                constraint: 'fk_user_tenant_user',
                key: 'user_id',
                references: 'users(id)',
                onDelete: 'CASCADE'
            },
            {
                table: 'user_tenant_assignments',
                constraint: 'fk_user_tenant_tenant',
                key: 'tenant_id',
                references: 'tenants(id)',
                onDelete: 'CASCADE'
            },
            {
                table: 'user_tenant_assignments',
                constraint: 'fk_user_tenant_assigned_by',
                key: 'assigned_by',
                references: 'admin_users(id)',
                onDelete: 'SET NULL'
            },
            {
                table: 'role_permissions',
                constraint: 'fk_role_permissions_role',
                key: 'role_id',
                references: 'roles(id)',
                onDelete: 'CASCADE'
            },
            {
                table: 'role_permissions',
                constraint: 'fk_role_permissions_permission',
                key: 'permission_id',
                references: 'permissions(id)',
                onDelete: 'CASCADE'
            },
            {
                table: 'audit_logs',
                constraint: 'fk_audit_user',
                key: 'user_id',
                references: 'users(id)',
                onDelete: 'SET NULL'
            },
            {
                table: 'audit_logs',
                constraint: 'fk_audit_tenant',
                key: 'tenant_id',
                references: 'tenants(id)',
                onDelete: 'SET NULL'
            },
            {
                table: 'audit_summary',
                constraint: 'fk_summary_created_by',
                key: 'created_by_user_id',
                references: 'users(id)',
                onDelete: 'SET NULL'
            },
            {
                table: 'audit_summary',
                constraint: 'fk_summary_last_modified_by',
                key: 'last_modified_by_user_id',
                references: 'users(id)',
                onDelete: 'SET NULL'
            },
            {
                table: 'audit_summary',
                constraint: 'fk_summary_deleted_by',
                key: 'deleted_by_user_id',
                references: 'users(id)',
                onDelete: 'SET NULL'
            },
            {
                table: 'audit_summary',
                constraint: 'fk_summary_tenant',
                key: 'tenant_id',
                references: 'tenants(id)',
                onDelete: 'SET NULL'
            }
        ];

        for (const fk of foreignKeys) {
            try {
                await this.executeQuery(`
                    ALTER TABLE \`${fk.table}\` 
                    ADD CONSTRAINT \`${fk.constraint}\` 
                    FOREIGN KEY (\`${fk.key}\`) 
                    REFERENCES \`${fk.references}\` 
                    ON DELETE ${fk.onDelete}
                `);
                this.log(`Added foreign key: ${fk.constraint}`);
            } catch (error) {
                if (error.code === 'ER_DUP_KEYNAME') {
                    this.log(`Foreign key ${fk.constraint} already exists, skipping...`);
                } else {
                    this.log(`Failed to add foreign key ${fk.constraint}: ${error.message}`, 'WARN');
                }
            }
        }

        this.log('Foreign key constraints added successfully');
    }

    async insertDefaultData() {
        this.log('Inserting default data...');

        // Insert default roles
        const roles = [
            ['admin', 'Administrator', 'Full system access with all permissions', 1],
            ['invoice_creator', 'Invoice Creator', 'Can create, edit, and manage invoices', 1],
            ['buyer_manager', 'Buyer Manager', 'Can manage buyers and buyer-related operations', 1],
            ['product_manager', 'Product Manager', 'Can manage products and product-related operations', 1],
            ['viewer', 'Viewer', 'Read-only access to view data', 1]
        ];

        for (const role of roles) {
            await this.executeQuery(`
                INSERT IGNORE INTO \`roles\` (\`name\`, \`display_name\`, \`description\`, \`is_system_role\`) 
                VALUES (?, ?, ?, ?)
            `, role);
        }

        // Insert default permissions
        const permissions = [
            // User Management
            ['create_user', 'Create User', 'Create new users', 'User Management'],
            ['read_user', 'Read User', 'View user information', 'User Management'],
            ['update_user', 'Update User', 'Update user information', 'User Management'],
            ['delete_user', 'Delete User', 'Delete users', 'User Management'],

            // Role Management
            ['create_role', 'Create Role', 'Create new roles', 'Role Management'],
            ['read_role', 'Read Role', 'View role information', 'Role Management'],
            ['update_role', 'Update Role', 'Update role information', 'Role Management'],
            ['delete_role', 'Delete Role', 'Delete roles', 'Role Management'],

            // Invoice Management
            ['create_invoice', 'Create Invoice', 'Create new invoices', 'Invoice Management'],
            ['read_invoice', 'Read Invoice', 'View invoice information', 'Invoice Management'],
            ['update_invoice', 'Update Invoice', 'Update invoice information', 'Invoice Management'],
            ['delete_invoice', 'Delete Invoice', 'Delete invoices', 'Invoice Management'],
            ['invoice_uploader', 'Invoice Uploader', 'Upload invoices', 'Invoice Management'],
            ['invoice_validate', 'Invoice Validate', 'Validate invoices', 'Invoice Management'],
            ['invoice_save', 'Invoice Save', 'Save invoices', 'Invoice Management'],

            // Buyer Management
            ['create_buyer', 'Create Buyer', 'Create new buyers', 'Buyer Management'],
            ['read_buyer', 'Read Buyer', 'View buyer information', 'Buyer Management'],
            ['update_buyer', 'Update Buyer', 'Update buyer information', 'Buyer Management'],
            ['delete_buyer', 'Delete Buyer', 'Delete buyers', 'Buyer Management'],
            ['buyer_uploader', 'Buyer Uploader', 'Upload buyers', 'Buyer Management'],

            // Product Management
            ['create_product', 'Create Product', 'Create new products', 'Product Management'],
            ['read_product', 'Read Product', 'View product information', 'Product Management'],
            ['update_product', 'Update Product', 'Update product information', 'Product Management'],
            ['delete_product', 'Delete Product', 'Delete products', 'Product Management'],
            ['product_uploader', 'Product Uploader', 'Upload products', 'Product Management'],

            // Dashboard & Reports
            ['view_dashboard', 'View Dashboard', 'View dashboard and overview', 'Dashboard'],
            ['report_view', 'Report View', 'View reports', 'Report Management']
        ];

        for (const permission of permissions) {
            await this.executeQuery(`
                INSERT IGNORE INTO \`permissions\` (\`name\`, \`display_name\`, \`description\`, \`category\`) 
                VALUES (?, ?, ?, ?)
            `, permission);
        }

        // Insert audit permissions
        const auditPermissions = [
            ['view_audit_logs', 'View Audit Logs', 'View audit trail for all operations'],
            ['view_audit_summary', 'View Audit Summary', 'View audit summary for entities'],
            ['export_audit_logs', 'Export Audit Logs', 'Export audit logs to files'],
            ['view_user_audit', 'View User Audit', 'View audit logs for user management operations'],
            ['view_invoice_audit', 'View Invoice Audit', 'View audit logs for invoice operations'],
            ['view_buyer_audit', 'View Buyer Audit', 'View audit logs for buyer operations'],
            ['view_product_audit', 'View Product Audit', 'View audit logs for product operations'],
            ['view_bulk_audit', 'View Bulk Operations Audit', 'View audit logs for bulk operations']
        ];

        for (const auditPermission of auditPermissions) {
            await this.executeQuery(`
                INSERT IGNORE INTO \`audit_permissions\` (\`permission_name\`, \`display_name\`, \`description\`) 
                VALUES (?, ?, ?)
            `, auditPermission);
        }

        this.log('Default data inserted successfully');
    }

    async assignPermissionsToRoles() {
        this.log('Assigning permissions to roles...');

        // Assign all permissions to admin role
        await this.executeQuery(`
            INSERT IGNORE INTO \`role_permissions\` (\`role_id\`, \`permission_id\`)
            SELECT r.id, p.id
            FROM \`roles\` r
            CROSS JOIN \`permissions\` p
            WHERE r.name = 'admin'
        `);

        // Assign audit permissions to admin role
        await this.executeQuery(`
            INSERT IGNORE INTO \`role_permissions\` (\`role_id\`, \`permission_id\`)
            SELECT r.id, ap.id
            FROM \`roles\` r
            CROSS JOIN \`audit_permissions\` ap
            WHERE r.name = 'admin'
        `);

        // Assign invoice-related permissions to invoice_creator role
        await this.executeQuery(`
            INSERT IGNORE INTO \`role_permissions\` (\`role_id\`, \`permission_id\`)
            SELECT r.id, p.id
            FROM \`roles\` r
            CROSS JOIN \`permissions\` p
            WHERE r.name = 'invoice_creator'
            AND p.name IN (
                'create_invoice', 'read_invoice', 'update_invoice', 'delete_invoice',
                'invoice_uploader', 'invoice_validate', 'invoice_save',
                'view_dashboard', 'report_view'
            )
        `);

        // Assign audit permissions to invoice_creator role
        await this.executeQuery(`
            INSERT IGNORE INTO \`role_permissions\` (\`role_id\`, \`permission_id\`)
            SELECT r.id, ap.id
            FROM \`roles\` r
            CROSS JOIN \`audit_permissions\` ap
            WHERE r.name = 'invoice_creator'
            AND ap.permission_name IN ('view_invoice_audit', 'view_bulk_audit')
        `);

        // Assign buyer-related permissions to buyer_manager role
        await this.executeQuery(`
            INSERT IGNORE INTO \`role_permissions\` (\`role_id\`, \`permission_id\`)
            SELECT r.id, p.id
            FROM \`roles\` r
            CROSS JOIN \`permissions\` p
            WHERE r.name = 'buyer_manager'
            AND p.name IN (
                'create_buyer', 'read_buyer', 'update_buyer', 'delete_buyer',
                'buyer_uploader', 'view_dashboard', 'report_view'
            )
        `);

        // Assign audit permissions to buyer_manager role
        await this.executeQuery(`
            INSERT IGNORE INTO \`role_permissions\` (\`role_id\`, \`permission_id\`)
            SELECT r.id, ap.id
            FROM \`roles\` r
            CROSS JOIN \`audit_permissions\` ap
            WHERE r.name = 'buyer_manager'
            AND ap.permission_name IN ('view_buyer_audit')
        `);

        // Assign product-related permissions to product_manager role
        await this.executeQuery(`
            INSERT IGNORE INTO \`role_permissions\` (\`role_id\`, \`permission_id\`)
            SELECT r.id, p.id
            FROM \`roles\` r
            CROSS JOIN \`permissions\` p
            WHERE r.name = 'product_manager'
            AND p.name IN (
                'create_product', 'read_product', 'update_product', 'delete_product',
                'product_uploader', 'view_dashboard', 'report_view'
            )
        `);

        // Assign audit permissions to product_manager role
        await this.executeQuery(`
            INSERT IGNORE INTO \`role_permissions\` (\`role_id\`, \`permission_id\`)
            SELECT r.id, ap.id
            FROM \`roles\` r
            CROSS JOIN \`audit_permissions\` ap
            WHERE r.name = 'product_manager'
            AND ap.permission_name IN ('view_product_audit')
        `);

        // Assign read-only permissions to viewer role
        await this.executeQuery(`
            INSERT IGNORE INTO \`role_permissions\` (\`role_id\`, \`permission_id\`)
            SELECT r.id, p.id
            FROM \`roles\` r
            CROSS JOIN \`permissions\` p
            WHERE r.name = 'viewer'
            AND p.name IN (
                'read_invoice', 'read_buyer', 'read_product', 'read_user',
                'view_dashboard', 'report_view'
            )
        `);

        this.log('Permissions assigned to roles successfully');
    }

    async createViews() {
        this.log('Creating views...');

        // Create audit_logs_detailed view
        await this.executeQuery(`
            CREATE OR REPLACE VIEW \`audit_logs_detailed\` AS
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
            FROM \`audit_logs\` al
            LEFT JOIN \`users\` u ON al.user_id = u.id
            LEFT JOIN \`tenants\` t ON al.tenant_id = t.id
        `);

        // Create audit_summary_detailed view
        await this.executeQuery(`
            CREATE OR REPLACE VIEW \`audit_summary_detailed\` AS
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
            FROM \`audit_summary\` asum
            LEFT JOIN \`users\` u_created ON asum.created_by_user_id = u_created.id
            LEFT JOIN \`users\` u_modified ON asum.last_modified_by_user_id = u_modified.id
            LEFT JOIN \`users\` u_deleted ON asum.deleted_by_user_id = u_deleted.id
            LEFT JOIN \`tenants\` t ON asum.tenant_id = t.id
        `);

        // Create user_permissions_view
        await this.executeQuery(`
            CREATE OR REPLACE VIEW \`user_permissions_view\` AS
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
            FROM \`users\` u
            LEFT JOIN \`roles\` r ON u.role_id = r.id
            LEFT JOIN \`role_permissions\` rp ON r.id = rp.role_id
            LEFT JOIN \`permissions\` p ON rp.permission_id = p.id
            WHERE u.is_active = 1 AND r.is_active = 1 AND p.is_active = 1
        `);

        this.log('Views created successfully');
    }

    async createStoredProcedures() {
        this.log('Creating stored procedures...');

        // Create LogAuditEntry procedure
        await this.executeQuery(`
            DELIMITER //
            CREATE PROCEDURE IF NOT EXISTS \`LogAuditEntry\`(
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
                INSERT INTO \`audit_logs\` (
                    \`entity_type\`, \`entity_id\`, \`operation\`, \`user_id\`, \`user_email\`, \`user_name\`, \`user_role\`,
                    \`tenant_id\`, \`tenant_name\`, \`old_values\`, \`new_values\`, \`changed_fields\`,
                    \`ip_address\`, \`user_agent\`, \`request_id\`, \`additional_info\`
                ) VALUES (
                    p_entity_type, p_entity_id, p_operation, p_user_id, p_user_email, p_user_name, p_user_role,
                    p_tenant_id, p_tenant_name, p_old_values, p_new_values, p_changed_fields,
                    p_ip_address, p_user_agent, p_request_id, p_additional_info
                );
            END //
            DELIMITER ;
        `);

        // Create UpdateAuditSummary procedure
        await this.executeQuery(`
            DELIMITER //
            CREATE PROCEDURE IF NOT EXISTS \`UpdateAuditSummary\`(
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
                INSERT INTO \`audit_summary\` (
                    \`entity_type\`, \`entity_id\`, \`entity_name\`, \`total_operations\`,
                    \`created_by_user_id\`, \`created_by_email\`, \`created_by_name\`, \`created_at\`,
                    \`last_modified_by_user_id\`, \`last_modified_by_email\`, \`last_modified_by_name\`, \`last_modified_at\`,
                    \`tenant_id\`, \`tenant_name\`, \`is_deleted\`, \`deleted_by_user_id\`, \`deleted_by_email\`, \`deleted_by_name\`, \`deleted_at\`
                ) VALUES (
                    p_entity_type, p_entity_id, p_entity_name, 1,
                    p_user_id, p_user_email, p_user_name, NOW(),
                    p_user_id, p_user_email, p_user_name, NOW(),
                    p_tenant_id, p_tenant_name, 0, NULL, NULL, NULL, NULL
                )
                ON DUPLICATE KEY UPDATE
                    \`total_operations\` = \`total_operations\` + 1,
                    \`last_modified_by_user_id\` = p_user_id,
                    \`last_modified_by_email\` = p_user_email,
                    \`last_modified_by_name\` = p_user_name,
                    \`last_modified_at\` = NOW(),
                    \`is_deleted\` = CASE WHEN p_operation = 'DELETE' THEN 1 ELSE \`is_deleted\` END,
                    \`deleted_by_user_id\` = CASE WHEN p_operation = 'DELETE' THEN p_user_id ELSE \`deleted_by_user_id\` END,
                    \`deleted_by_email\` = CASE WHEN p_operation = 'DELETE' THEN p_user_email ELSE \`deleted_by_email\` END,
                    \`deleted_by_name\` = CASE WHEN p_operation = 'DELETE' THEN p_user_name ELSE \`deleted_by_name\` END,
                    \`deleted_at\` = CASE WHEN p_operation = 'DELETE' THEN NOW() ELSE \`deleted_at\` END;
            END //
            DELIMITER ;
        `);

        this.log('Stored procedures created successfully');
    }

    async createIndexes() {
        this.log('Creating performance indexes...');

        const indexes = [
            'CREATE INDEX IF NOT EXISTS `idx_audit_logs_composite` ON `audit_logs` (`entity_type`, `entity_id`, `created_at`)',
            'CREATE INDEX IF NOT EXISTS `idx_audit_logs_user_tenant` ON `audit_logs` (`user_id`, `tenant_id`, `created_at`)',
            'CREATE INDEX IF NOT EXISTS `idx_audit_summary_entity_tenant` ON `audit_summary` (`entity_type`, `tenant_id`, `last_modified_at`)'
        ];

        for (const indexQuery of indexes) {
            try {
                await this.executeQuery(indexQuery);
            } catch (error) {
                if (error.code === 'ER_DUP_KEYNAME') {
                    this.log(`Index already exists, skipping...`);
                } else {
                    this.log(`Failed to create index: ${error.message}`, 'WARN');
                }
            }
        }

        this.log('Performance indexes created successfully');
    }

    async getSetupSummary() {
        this.log('Generating setup summary...');

        try {
            // Get table information
            const tables = await this.executeQuery(`
                SELECT TABLE_NAME as table_name, TABLE_ROWS as estimated_rows 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME IN ('users', 'user_tenant_assignments', 'roles', 'permissions', 'role_permissions', 'audit_logs', 'audit_summary', 'audit_permissions')
                ORDER BY TABLE_NAME
            `);

            // Get roles information
            const roles = await this.executeQuery(`
                SELECT name, display_name, description FROM roles ORDER BY name
            `);

            // Get permission counts
            const permissionCounts = await this.executeQuery(`
                SELECT 
                    (SELECT COUNT(*) FROM permissions) as total_permissions,
                    (SELECT COUNT(*) FROM audit_permissions) as total_audit_permissions
            `);

            // Get role-permission assignments
            const roleAssignments = await this.executeQuery(`
                SELECT r.name as role_name, COUNT(rp.permission_id) as permission_count 
                FROM roles r 
                LEFT JOIN role_permissions rp ON r.id = rp.role_id 
                GROUP BY r.id, r.name 
                ORDER BY r.name
            `);

            return {
                tables,
                roles,
                permissionCounts: permissionCounts[0],
                roleAssignments
            };
        } catch (error) {
            this.log(`Failed to generate summary: ${error.message}`, 'ERROR');
            return null;
        }
    }

    async runCompleteSetup() {
        try {
            this.log('Starting complete audit and user management system setup...');
            
            await this.connect();
            await this.createTables();
            await this.addForeignKeys();
            await this.insertDefaultData();
            await this.assignPermissionsToRoles();
            await this.createViews();
            await this.createStoredProcedures();
            await this.createIndexes();
            
            const summary = await this.getSetupSummary();
            
            this.log('AUDIT & USER MANAGEMENT SYSTEM SETUP COMPLETE');
            
            if (summary) {
                this.log('Setup Summary:');
                this.log(`Tables Created: ${summary.tables.length}`);
                this.log(`Roles Created: ${summary.roles.length}`);
                this.log(`Total Permissions: ${summary.permissionCounts.total_permissions}`);
                this.log(`Total Audit Permissions: ${summary.permissionCounts.total_audit_permissions}`);
                
                this.log('Role-Permission Assignments:');
                summary.roleAssignments.forEach(assignment => {
                    this.log(`  ${assignment.role_name}: ${assignment.permission_count} permissions`);
                });
            }
            
            return {
                success: true,
                summary,
                log: this.setupLog
            };
            
        } catch (error) {
            this.log(`Setup failed: ${error.message}`, 'ERROR');
            return {
                success: false,
                error: error.message,
                log: this.setupLog
            };
        } finally {
            await this.disconnect();
        }
    }
}

// Main execution
async function main() {
    const setup = new AuditUserManagementSetup();
    const result = await setup.runCompleteSetup();
    
    if (result.success) {
        console.log('\n✅ Setup completed successfully!');
        console.log('Check the log above for detailed information.');
    } else {
        console.log('\n❌ Setup failed!');
        console.log('Error:', result.error);
        process.exit(1);
    }
}

// Run if this file is executed directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = AuditUserManagementSetup;
