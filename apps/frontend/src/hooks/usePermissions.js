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
      
      // For admin users, they have all permissions by default
      if (isAdmin()) {
        setPermissions([]); // Admin users don't need to fetch permissions
        setLoading(false);
        return;
      }
      
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
    // Admin users have all permissions
    if (isAdmin()) return true;
    
    if (!permissions || permissions.length === 0) return false;
    return permissions.some(permission => permission.name === permissionName);
  };

  /**
   * Check if user has any of the specified permissions
   * @param {string[]} permissionNames - Array of permission names to check
   * @returns {boolean} True if user has any of the permissions
   */
  const hasAnyPermission = (permissionNames) => {
    // Admin users have all permissions
    if (isAdmin()) return true;
    
    if (!permissions || permissions.length === 0) return false;
    return permissionNames.some(permissionName => 
      permissions.some(permission => permission.name === permissionName)
    );
  };

  /**
   * Check if user has all of the specified permissions
   * @param {string[]} permissionNames - Array of permission names to check
   * @returns {boolean} True if user has all of the permissions
   */
  const hasAllPermissions = (permissionNames) => {
    // Admin users have all permissions
    if (isAdmin()) return true;
    
    if (!permissions || permissions.length === 0) return false;
    return permissionNames.every(permissionName => 
      permissions.some(permission => permission.name === permissionName)
    );
  };

  /**
   * Check if user has admin role
   * @returns {boolean} True if user is admin
   */
  const isAdmin = () => {
    return user?.role === 'admin' || user?.type === 'admin';
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
