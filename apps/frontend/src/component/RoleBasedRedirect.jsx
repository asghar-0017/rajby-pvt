import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../Context/AuthProvider';
import { usePermissions } from '../hooks/usePermissions';

const RoleBasedRedirect = () => {
  const { user } = useAuth();
  const { hasPermission, isAdmin, loading, permissions } = usePermissions();

  // Show loading while permissions are being fetched
  if (loading) {
    return <div>Loading...</div>;
  }

  // If user is admin, redirect to dashboard
  if (isAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  // Check user role for specific redirects (highest priority)
  if (user?.userRole?.name === 'buyer_manager') {
    return <Navigate to="/buyers" replace />;
  }

  // If user has buyer permissions, redirect to buyers page
  if (hasPermission('buyer.view')) {
    return <Navigate to="/buyers" replace />;
  }

  // If user has product permissions, redirect to products page
  if (hasPermission('product.view')) {
    return <Navigate to="/products" replace />;
  }

  // If user has invoice permissions, redirect to invoice list
  if (hasPermission('invoice.view')) {
    return <Navigate to="/your-invoices" replace />;
  }

  // If user has dashboard permission, redirect to dashboard
  if (hasPermission('dashboard.view')) {
    return <Navigate to="/dashboard" replace />;
  }

  // If user has any permissions, redirect based on the first available permission
  if (permissions && permissions.length > 0) {
    const firstPermission = permissions[0];
    const category = firstPermission.category;
    
    switch (category) {
      case 'buyer':
        return <Navigate to="/buyers" replace />;
      case 'product':
        return <Navigate to="/products" replace />;
      case 'invoice':
        return <Navigate to="/your-invoices" replace />;
      case 'dashboard':
        return <Navigate to="/dashboard" replace />;
      default:
        // If category is not recognized, check individual permissions
        if (hasPermission('buyer.view')) return <Navigate to="/buyers" replace />;
        if (hasPermission('product.view')) return <Navigate to="/products" replace />;
        if (hasPermission('invoice.view')) return <Navigate to="/your-invoices" replace />;
        if (hasPermission('dashboard.view')) return <Navigate to="/dashboard" replace />;
    }
  }

  // Default fallback to dashboard
  return <Navigate to="/dashboard" replace />;
};

export default RoleBasedRedirect;
