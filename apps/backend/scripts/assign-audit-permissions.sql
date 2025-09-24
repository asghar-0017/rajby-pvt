-- Add audit permissions to existing roles (if they exist)
-- This will add audit permissions to admin role and invoice_creator role
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
CROSS JOIN `audit_permissions` p
WHERE r.name IN ('admin', 'invoice_creator')
AND p.permission_name IN ('view_audit_logs', 'view_audit_summary', 'view_user_audit', 'view_invoice_audit', 'view_buyer_audit', 'view_product_audit');
