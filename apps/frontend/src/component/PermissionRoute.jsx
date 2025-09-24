import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import CircularProgress from '@mui/material/CircularProgress';
import { Box, Typography, Alert } from '@mui/material';

/**
 * PermissionRoute component that protects routes based on user permissions
 * @param {Object} props - Component props
 * @param {string|string[]} props.permission - Single permission or array of permissions required
 * @param {string} props.mode - 'any' (default) or 'all' - whether user needs any or all permissions
 * @param {boolean} props.adminOverride - If true, admin users bypass permission checks (default: true)
 * @param {React.ReactNode} props.children - Content to render if permission check passes
 * @param {string} props.redirectTo - Route to redirect to if permission check fails (default: '/dashboard')
 * @param {boolean} props.showAccessDenied - If true, shows access denied message instead of redirecting
 * @returns {React.ReactNode} Protected content or redirect/error message
 */
const PermissionRoute = ({
  permission,
  mode = 'any',
  adminOverride = true,
  children,
  redirectTo = '/dashboard',
  showAccessDenied = false,
  ...props
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, isAdmin, loading } = usePermissions();

  // Show loading while permissions are being fetched
  if (loading) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="50vh">
        <CircularProgress size={40} />
        <Typography variant="body2" sx={{ mt: 2 }}>Loading permissions...</Typography>
      </Box>
    );
  }

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

  // Show access denied message or redirect
  if (showAccessDenied) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="50vh" p={3}>
        <Alert severity="error" sx={{ mb: 2, maxWidth: 500 }}>
          <Typography variant="h6" gutterBottom>
            Access Denied
          </Typography>
          <Typography variant="body2">
            You don't have permission to access this page. Required permission: {Array.isArray(permission) ? permission.join(', ') : permission}
          </Typography>
        </Alert>
      </Box>
    );
  }

  // Redirect to specified route
  return <Navigate to={redirectTo} replace />;
};

export default PermissionRoute;
