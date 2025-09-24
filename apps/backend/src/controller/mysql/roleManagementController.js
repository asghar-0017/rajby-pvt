import RoleManagementService from "../../service/RoleManagementService.js";

class RoleManagementController {
  // Get all roles
  async getAllRoles(req, res) {
    try {
      const roles = await RoleManagementService.getAllRoles();
      
      res.status(200).json({
        success: true,
        data: roles,
        message: "Roles fetched successfully",
      });
    } catch (error) {
      console.error("Error in getAllRoles:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch roles",
        error: error.message,
      });
    }
  }

  // Get all permissions
  async getAllPermissions(req, res) {
    try {
      const permissions = await RoleManagementService.getAllPermissions();
      
      res.status(200).json({
        success: true,
        data: permissions,
        message: "Permissions fetched successfully",
      });
    } catch (error) {
      console.error("Error in getAllPermissions:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch permissions",
        error: error.message,
      });
    }
  }

  // Get permissions grouped by resource
  async getPermissionsGroupedByResource(req, res) {
    try {
      const groupedPermissions = await RoleManagementService.getPermissionsGroupedByResource();
      
      res.status(200).json({
        success: true,
        data: groupedPermissions,
        message: "Permissions grouped by resource fetched successfully",
      });
    } catch (error) {
      console.error("Error in getPermissionsGroupedByResource:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch grouped permissions",
        error: error.message,
      });
    }
  }

  // Create a new role
  async createRole(req, res) {
    try {
      const { name, description, permissions } = req.body;
      const createdByAdminId = req.user.id;

      // Validate required fields
      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Role name is required",
        });
      }

      const roleData = {
        name: name.trim(),
        description: description?.trim() || "",
        permissions: permissions || [],
      };

      const newRole = await RoleManagementService.createRole(roleData, createdByAdminId);

      res.status(201).json({
        success: true,
        data: newRole,
        message: "Role created successfully",
      });
    } catch (error) {
      console.error("Error in createRole:", error);
      
      if (error.message.includes("already exists")) {
        return res.status(409).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: "Failed to create role",
        error: error.message,
      });
    }
  }

  // Update a role
  async updateRole(req, res) {
    try {
      const { roleId } = req.params;
      const { name, description, permissions } = req.body;
      const updatedByAdminId = req.user.id;

      // Validate required fields
      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Role name is required",
        });
      }

      const roleData = {
        name: name.trim(),
        description: description?.trim() || "",
        permissions: permissions || [],
      };

      const updatedRole = await RoleManagementService.updateRole(roleId, roleData, updatedByAdminId);

      res.status(200).json({
        success: true,
        data: updatedRole,
        message: "Role updated successfully",
      });
    } catch (error) {
      console.error("Error in updateRole:", error);
      
      if (error.message.includes("not found")) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      if (error.message.includes("system roles") || error.message.includes("already exists")) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: "Failed to update role",
        error: error.message,
      });
    }
  }

  // Delete a role
  async deleteRole(req, res) {
    try {
      const { roleId } = req.params;

      const result = await RoleManagementService.deleteRole(roleId);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      console.error("Error in deleteRole:", error);
      
      if (error.message.includes("not found")) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      if (error.message.includes("system roles") || error.message.includes("assigned to users")) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: "Failed to delete role",
        error: error.message,
      });
    }
  }

  // Get role by ID
  async getRoleById(req, res) {
    try {
      const { roleId } = req.params;

      const role = await RoleManagementService.getRoleById(roleId);

      res.status(200).json({
        success: true,
        data: role,
        message: "Role fetched successfully",
      });
    } catch (error) {
      console.error("Error in getRoleById:", error);
      
      if (error.message.includes("not found")) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: "Failed to fetch role",
        error: error.message,
      });
    }
  }

  // Check user permission
  async checkUserPermission(req, res) {
    try {
      const { userId } = req.params;
      const { permission } = req.query;

      if (!permission) {
        return res.status(400).json({
          success: false,
          message: "Permission name is required",
        });
      }

      const hasPermission = await RoleManagementService.userHasPermission(userId, permission);

      res.status(200).json({
        success: true,
        data: { hasPermission },
        message: "Permission check completed",
      });
    } catch (error) {
      console.error("Error in checkUserPermission:", error);
      res.status(500).json({
        success: false,
        message: "Failed to check permission",
        error: error.message,
      });
    }
  }

  // Get user permissions
  async getUserPermissions(req, res) {
    try {
      const { userId } = req.params;

      const permissions = await RoleManagementService.getUserPermissions(userId);

      res.status(200).json({
        success: true,
        data: permissions,
        message: "User permissions fetched successfully",
      });
    } catch (error) {
      console.error("Error in getUserPermissions:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch user permissions",
        error: error.message,
      });
    }
  }

  // Get current user's permissions (for regular users)
  async getMyPermissions(req, res) {
    try {
      const userId = req.user.userId;
      const userEmail = req.user.email; // Get user email from JWT token

      const permissions = await RoleManagementService.getUserPermissions(userId, userEmail);

      res.status(200).json({
        success: true,
        data: permissions,
        message: "Your permissions fetched successfully",
      });
    } catch (error) {
      console.error("Error in getMyPermissions:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch your permissions",
        error: error.message,
      });
    }
  }

  // Check current user's permission (for regular users)
  async checkMyPermission(req, res) {
    try {
      const userId = req.user.userId;
      const { permission } = req.query;

      if (!permission) {
        return res.status(400).json({
          success: false,
          message: "Permission name is required",
        });
      }

      const hasPermission = await RoleManagementService.userHasPermission(userId, permission);

      res.status(200).json({
        success: true,
        data: { hasPermission },
        message: "Permission check completed",
      });
    } catch (error) {
      console.error("Error in checkMyPermission:", error);
      res.status(500).json({
        success: false,
        message: "Failed to check permission",
        error: error.message,
      });
    }
  }
}

export default new RoleManagementController();