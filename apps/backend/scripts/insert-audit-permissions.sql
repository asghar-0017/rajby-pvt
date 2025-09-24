-- Insert audit permissions
INSERT IGNORE INTO `audit_permissions` (`permission_name`, `display_name`, `description`) VALUES
('view_audit_logs', 'View Audit Logs', 'View audit trail for all operations'),
('view_audit_summary', 'View Audit Summary', 'View audit summary for entities'),
('export_audit_logs', 'Export Audit Logs', 'Export audit logs to files'),
('view_user_audit', 'View User Audit', 'View audit logs for user management operations'),
('view_invoice_audit', 'View Invoice Audit', 'View audit logs for invoice operations'),
('view_buyer_audit', 'View Buyer Audit', 'View audit logs for buyer operations'),
('view_product_audit', 'View Product Audit', 'View audit logs for product operations');
