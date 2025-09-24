import RoleManagementService from "../service/RoleManagementService.js";

/**
 * Middleware to check if user has specific permission
 * @param {string} permissionName - The permission name to check (e.g., 'buyer.view', 'invoice.create')
 * @returns {Function} Express middleware function
 */
export const requirePermission = (permissionName) => {
  return async (req, res, next) => {
    try {
      // Get user from request (set by auth middleware)
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      // Check if user has the required permission
      const hasPermission = await RoleManagementService.userHasPermission(user.userId || user.id, permissionName, user.email);
      
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required permission: ${permissionName}`,
        });
      }

      // User has permission, proceed to next middleware
      next();
    } catch (error) {
      console.error("Error in permission middleware:", error);
      res.status(500).json({
        success: false,
        message: "Error checking permissions",
        error: error.message,
      });
    }
  };
};

/**
 * Middleware to check if user has any of the specified permissions
 * @param {string[]} permissions - Array of permission names to check
 * @returns {Function} Express middleware function
 */
export const requireAnyPermission = (permissions) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      // Check if user has any of the required permissions
      const permissionChecks = await Promise.all(
        permissions.map(permission => 
          RoleManagementService.userHasPermission(user.userId || user.id, permission, user.email)
        )
      );

      const hasAnyPermission = permissionChecks.some(hasPermission => hasPermission);
      
      if (!hasAnyPermission) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required one of: ${permissions.join(', ')}`,
        });
      }

      next();
    } catch (error) {
      console.error("Error in permission middleware:", error);
      res.status(500).json({
        success: false,
        message: "Error checking permissions",
        error: error.message,
      });
    }
  };
};

/**
 * Middleware to check if user has all of the specified permissions
 * @param {string[]} permissions - Array of permission names to check
 * @returns {Function} Express middleware function
 */
export const requireAllPermissions = (permissions) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      // Check if user has all of the required permissions
      const permissionChecks = await Promise.all(
        permissions.map(permission => 
          RoleManagementService.userHasPermission(user.userId || user.id, permission, user.email)
        )
      );

      const hasAllPermissions = permissionChecks.every(hasPermission => hasPermission);
      
      if (!hasAllPermissions) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required all of: ${permissions.join(', ')}`,
        });
      }

      next();
    } catch (error) {
      console.error("Error in permission middleware:", error);
      res.status(500).json({
        success: false,
        message: "Error checking permissions",
        error: error.message,
      });
    }
  };
};

/**
 * Middleware to check if user has admin role or specific permission
 * @param {string} permissionName - The permission name to check
 * @returns {Function} Express middleware function
 */
export const requireAdminOrPermission = (permissionName) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      // Check if user is admin
      if (user.type === 'admin') {
        return next();
      }

      // Check if user has the required permission
      const hasPermission = await RoleManagementService.userHasPermission(user.userId || user.id, permissionName, user.email);
      
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required admin role or permission: ${permissionName}`,
        });
      }

      next();
    } catch (error) {
      console.error("Error in permission middleware:", error);
      res.status(500).json({
        success: false,
        message: "Error checking permissions",
        error: error.message,
      });
    }
  };
};
