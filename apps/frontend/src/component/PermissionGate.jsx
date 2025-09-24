import React from 'react';
import { usePermissions } from '../hooks/usePermissions';

/**
 * PermissionGate component for conditional rendering based on user permissions
 * @param {Object} props - Component props
 * @param {string|string[]} props.permission - Single permission or array of permissions to check
 * @param {string} props.mode - 'any' (default) or 'all' - whether user needs any or all permissions
 * @param {boolean} props.adminOverride - If true, admin users bypass permission checks (default: true)
 * @param {React.ReactNode} props.children - Content to render if permission check passes
 * @param {React.ReactNode} props.fallback - Content to render if permission check fails (optional)
 * @param {boolean} props.hide - If true, renders nothing instead of fallback when permission fails
 * @returns {React.ReactNode} Rendered content based on permissions
 */
const PermissionGate = ({
  permission,
  mode = 'any',
  adminOverride = false, // Changed default to false to be more restrictive
  children,
  fallback = null,
  hide = false,
  ...props
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, isAdmin } = usePermissions();

  // If no permission specified, render children
  if (!permission) {
    return children;
  }

  // Check if user is admin and admin override is enabled
  if (adminOverride && isAdmin()) {
    return children;
  }

  // Determine which permission check function to use
  let hasRequiredPermission = false;
  
  if (Array.isArray(permission)) {
    // Multiple permissions
    if (mode === 'all') {
      hasRequiredPermission = hasAllPermissions(permission);
    } else {
      hasRequiredPermission = hasAnyPermission(permission);
    }
  } else {
    // Single permission
    hasRequiredPermission = hasPermission(permission);
  }

  // Render based on permission check result
  if (hasRequiredPermission) {
    return children;
  }

  // Return fallback or nothing based on hide prop
  return hide ? null : fallback;
};

export default PermissionGate;
