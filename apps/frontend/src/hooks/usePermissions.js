import { useState, useEffect, useContext } from 'react';
import { useAuth } from '../Context/AuthProvider';
import { api } from '../API/Api';

/**
 * Custom hook to manage user permissions
 * @returns {Object} Permission utilities and state
 */
export const usePermissions = () => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user?.id || user?.userId) {
      fetchUserPermissions();
    } else {
      setLoading(false);
    }
  }, [user?.id, user?.userId]);

  const fetchUserPermissions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Always fetch permissions from backend to get accurate permission data
      // Use the new user-specific endpoint instead of admin-only endpoint
      const response = await api.get(`/user-auth/my-permissions`);
      
      if (response.data.success) {
        setPermissions(response.data.data || []);
      } else {
        setError(response.data.message || 'Failed to fetch permissions');
        setPermissions([]);
      }
    } catch (err) {
      console.error('Error fetching user permissions:', err);
      setError(err.response?.data?.message || 'Failed to fetch permissions');
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Check if user has a specific permission
   * @param {string} permissionName - The permission name to check
   * @returns {boolean} True if user has the permission
   */
  const hasPermission = (permissionName) => {
    // Check if user has the permission in their fetched permissions
    if (permissions && permissions.length > 0) {
      const hasExplicitPermission = permissions.some(permission => permission.name === permissionName);
      if (hasExplicitPermission) return true;
    }
    
    // Admin users have all permissions (fallback for true admin users)
    if (isAdmin()) return true;
    
    return false;
  };

  /**
   * Check if user has any of the specified permissions
   * @param {string[]} permissionNames - Array of permission names to check
   * @returns {boolean} True if user has any of the permissions
   */
  const hasAnyPermission = (permissionNames) => {
    // Check if user has any of the permissions in their fetched permissions
    if (permissions && permissions.length > 0) {
      const hasAnyExplicitPermission = permissionNames.some(permissionName => 
        permissions.some(permission => permission.name === permissionName)
      );
      if (hasAnyExplicitPermission) return true;
    }
    
    // Admin users have all permissions (fallback for true admin users)
    if (isAdmin()) return true;
    
    return false;
  };

  /**
   * Check if user has all of the specified permissions
   * @param {string[]} permissionNames - Array of permission names to check
   * @returns {boolean} True if user has all of the permissions
   */
  const hasAllPermissions = (permissionNames) => {
    // Check if user has all of the permissions in their fetched permissions
    if (permissions && permissions.length > 0) {
      const hasAllExplicitPermissions = permissionNames.every(permissionName => 
        permissions.some(permission => permission.name === permissionName)
      );
      if (hasAllExplicitPermissions) return true;
    }
    
    // Admin users have all permissions (fallback for true admin users)
    if (isAdmin()) return true;
    
    return false;
  };

  /**
   * Check if user has admin role or system role with all permissions
   * @returns {boolean} True if user is admin or has system role
   */
  const isAdmin = () => {
    // Check for admin role or type
    if (user?.role === 'admin' || user?.type === 'admin') {
      return true;
    }
    
    // Check if user has a role name that indicates admin privileges
    const adminRoleNames = ['admin', 'administrator', 'super_admin'];
    if (user?.userRole?.name && adminRoleNames.includes(user.userRole.name.toLowerCase())) {
      return true;
    }
    
    // Check if user has a system role AND has admin-level permissions
    if (user?.userRole?.isSystemRole === true) {
      // Only consider system roles as admin if they have the actual admin role name
      // or if they have all the core admin permissions
      const hasAdminPermissions = hasAllPermissions([
        'create_user', 'read_user', 'update_user', 'delete_user',
        'create_role', 'read_role', 'update_role', 'delete_role'
      ]);
      
      if (user?.userRole?.name === 'admin' || hasAdminPermissions) {
        return true;
      }
    }
    
    return false;
  };

  /**
   * Check if user has admin role or specific permission
   * @param {string} permissionName - The permission name to check
   * @returns {boolean} True if user is admin or has the permission
   */
  const isAdminOrHasPermission = (permissionName) => {
    return isAdmin() || hasPermission(permissionName);
  };

  /**
   * Get permissions grouped by category
   * @returns {Object} Permissions grouped by category
   */
  const getPermissionsByCategory = () => {
    if (!permissions || permissions.length === 0) return {};
    
    return permissions.reduce((acc, permission) => {
      const category = permission.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(permission);
      return acc;
    }, {});
  };

  return {
    permissions,
    loading,
    error,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isAdmin,
    isAdminOrHasPermission,
    getPermissionsByCategory,
    refetch: fetchUserPermissions
  };
};

export default usePermissions;
