import { Role, Permission, RolePermission, User } from "../model/mysql/associations.js";
import AdminUser from "../model/mysql/AdminUser.js";
import { masterSequelize } from "../config/mysql.js";

class RoleManagementService {
  // Get all roles with their permissions
  async getAllRoles() {
    try {
      const roles = await Role.findAll({
        include: [
          {
            model: Permission,
            as: "permissions",
            through: { attributes: [] }, // Exclude junction table attributes
          },
        ],
        order: [["name", "ASC"]],
      });

      return roles;
    } catch (error) {
      console.error("Error fetching roles:", error);
      throw error;
    }
  }

  // Get all permissions
  async getAllPermissions() {
    try {
      const permissions = await Permission.findAll({
        order: [["category", "ASC"], ["name", "ASC"]],
      });

      return permissions;
    } catch (error) {
      console.error("Error fetching permissions:", error);
      throw error;
    }
  }

  // Get permissions grouped by resource
  async getPermissionsGroupedByResource() {
    try {
      const permissions = await this.getAllPermissions();
      
      const grouped = permissions.reduce((acc, permission) => {
        const category = permission.category;
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(permission);
        return acc;
      }, {});

      return grouped;
    } catch (error) {
      console.error("Error grouping permissions:", error);
      throw error;
    }
  }

  // Create a new role
  async createRole(roleData, createdByAdminId) {
    const transaction = await masterSequelize.transaction();
    
    try {
      const { name, description, permissions = [], displayName } = roleData;

      // Check if role already exists
      const existingRole = await Role.findOne({ where: { name } });
      if (existingRole) {
        throw new Error("Role with this name already exists");
      }

      // Create the role
      const role = await Role.create(
        {
          name,
          displayName: displayName || name, // Use displayName if provided, otherwise use name
          description,
          isSystemRole: false,
          isActive: true,
          createdBy: createdByAdminId,
        },
        { transaction }
      );

      // Assign permissions to the role with conditional logic
      if (permissions.length > 0) {
        let finalPermissions = [...permissions];
        
        // Get all permissions to check for conditional grants
        const allPermissions = await Permission.findAll();
        
        // If user has invoice uploader permission, automatically add download template permission
        const hasUploaderPermission = permissions.some(permId => {
          const perm = allPermissions.find(p => p.id === permId);
          return perm && (perm.name === 'invoice.uploader' || perm.name === 'Invoice Uploader');
        });
        
        if (hasUploaderPermission) {
          const templatePermission = allPermissions.find(p => 
            p.name === 'invoice.template' || p.name === 'Download Invoice Template'
          );
          if (templatePermission && !finalPermissions.includes(templatePermission.id)) {
            finalPermissions.push(templatePermission.id);
          }
        } else {
          // If user doesn't have uploader permission, ensure template permission is not included
          const templatePermission = allPermissions.find(p => 
            p.name === 'invoice.template' || p.name === 'Download Invoice Template'
          );
          if (templatePermission) {
            finalPermissions = finalPermissions.filter(id => id !== templatePermission.id);
          }
        }
        
        // If user has validate permission, automatically add save permission
        const hasValidatePermission = permissions.some(permId => {
          const perm = allPermissions.find(p => p.id === permId);
          return perm && (perm.name === 'invoice_validate' || perm.name === 'Validate Invoice');
        });
        
        if (hasValidatePermission) {
          const savePermission = allPermissions.find(p => 
            p.name === 'invoice.save' || p.name === 'Save Invoice'
          );
          if (savePermission && !finalPermissions.includes(savePermission.id)) {
            finalPermissions.push(savePermission.id);
          }
        } else {
          // If user doesn't have validate permission, ensure save permission is not included
          const savePermission = allPermissions.find(p => 
            p.name === 'invoice.save' || p.name === 'Save Invoice'
          );
          if (savePermission) {
            finalPermissions = finalPermissions.filter(id => id !== savePermission.id);
          }
        }
        
        // If user has report permission, automatically add product.view, buyer.view, and invoice.view permissions
        const hasReportPermission = permissions.some(permId => {
          const perm = allPermissions.find(p => p.id === permId);
          return perm && (perm.name === 'report.view' || perm.name === 'View Reports');
        });
        
        if (hasReportPermission) {
          const productViewPermission = allPermissions.find(p => 
            p.name === 'product.view' || p.name === 'View Products'
          );
          if (productViewPermission && !finalPermissions.includes(productViewPermission.id)) {
            finalPermissions.push(productViewPermission.id);
          }
          
          const buyerViewPermission = allPermissions.find(p => 
            p.name === 'buyer.view' || p.name === 'View Buyers'
          );
          if (buyerViewPermission && !finalPermissions.includes(buyerViewPermission.id)) {
            finalPermissions.push(buyerViewPermission.id);
          }
          
          const invoiceViewPermission = allPermissions.find(p => 
            p.name === 'invoice.view' || p.name === 'View Invoices'
          );
          if (invoiceViewPermission && !finalPermissions.includes(invoiceViewPermission.id)) {
            finalPermissions.push(invoiceViewPermission.id);
          }
        }
        // Note: We don't remove explicit permissions if user doesn't have report access
        // This allows users to have buyer.view and product.view independently
        
        const rolePermissions = finalPermissions.map(permissionId => ({
          roleId: role.id,
          permissionId,
        }));

        await RolePermission.bulkCreate(rolePermissions, { transaction });
      }

      await transaction.commit();

      // Return role with permissions
      const roleWithPermissions = await Role.findByPk(role.id, {
        include: [
          {
            model: Permission,
            as: "permissions",
            through: { attributes: [] },
          },
        ],
      });

      return roleWithPermissions;
    } catch (error) {
      await transaction.rollback();
      console.error("Error creating role:", error);
      throw error;
    }
  }

  // Update a role
  async updateRole(roleId, roleData, updatedByAdminId) {
    const transaction = await masterSequelize.transaction();
    
    try {
      const { name, description, permissions = [] } = roleData;

      // Find the role
      const role = await Role.findByPk(roleId);
      if (!role) {
        throw new Error("Role not found");
      }

      // Check if it's a system role
      if (role.isSystemRole) {
        throw new Error("Cannot modify system roles");
      }

      // Check if name is being changed and if it conflicts
      if (name !== role.name) {
        const existingRole = await Role.findOne({ where: { name } });
        if (existingRole) {
          throw new Error("Role with this name already exists");
        }
      }

      // Update the role
      await role.update(
        {
          name,
          description,
        },
        { transaction }
      );

      // Update permissions
      // Remove existing permissions
      await RolePermission.destroy({
        where: { roleId: role.id },
        transaction,
      });

      // Add new permissions with conditional logic
      if (permissions.length > 0) {
        let finalPermissions = [...permissions];
        
        // Get all permissions to check for conditional grants
        const allPermissions = await Permission.findAll();
        
        // If user has invoice uploader permission, automatically add download template permission
        const hasUploaderPermission = permissions.some(permId => {
          const perm = allPermissions.find(p => p.id === permId);
          return perm && (perm.name === 'invoice.uploader' || perm.name === 'Invoice Uploader');
        });
        
        if (hasUploaderPermission) {
          const templatePermission = allPermissions.find(p => 
            p.name === 'invoice.template' || p.name === 'Download Invoice Template'
          );
          if (templatePermission && !finalPermissions.includes(templatePermission.id)) {
            finalPermissions.push(templatePermission.id);
          }
        } else {
          // If user doesn't have uploader permission, ensure template permission is not included
          const templatePermission = allPermissions.find(p => 
            p.name === 'invoice.template' || p.name === 'Download Invoice Template'
          );
          if (templatePermission) {
            finalPermissions = finalPermissions.filter(id => id !== templatePermission.id);
          }
        }
        
        // If user has validate permission, automatically add save permission
        const hasValidatePermission = permissions.some(permId => {
          const perm = allPermissions.find(p => p.id === permId);
          return perm && (perm.name === 'invoice.validat' || perm.name === 'Validate Invoice');
        });
        
        if (hasValidatePermission) {
          const savePermission = allPermissions.find(p => 
            p.name === 'invoice.save' || p.name === 'Save Invoice'
          );
          if (savePermission && !finalPermissions.includes(savePermission.id)) {
            finalPermissions.push(savePermission.id);
          }
        } else {
          // If user doesn't have validate permission, ensure save permission is not included
          const savePermission = allPermissions.find(p => 
            p.name === 'invoice.save' || p.name === 'Save Invoice'
          );
          if (savePermission) {
            finalPermissions = finalPermissions.filter(id => id !== savePermission.id);
          }
        }
        
        // If user has report permission, automatically add product.view, buyer.view, and invoice.view permissions
        const hasReportPermission = permissions.some(permId => {
          const perm = allPermissions.find(p => p.id === permId);
          return perm && (perm.name === 'report.view' || perm.name === 'View Reports');
        });
        
        if (hasReportPermission) {
          const productViewPermission = allPermissions.find(p => 
            p.name === 'product.view' || p.name === 'View Products'
          );
          if (productViewPermission && !finalPermissions.includes(productViewPermission.id)) {
            finalPermissions.push(productViewPermission.id);
          }
          
          const buyerViewPermission = allPermissions.find(p => 
            p.name === 'buyer.view' || p.name === 'View Buyers'
          );
          if (buyerViewPermission && !finalPermissions.includes(buyerViewPermission.id)) {
            finalPermissions.push(buyerViewPermission.id);
          }
          
          const invoiceViewPermission = allPermissions.find(p => 
            p.name === 'invoice.view' || p.name === 'View Invoices'
          );
          if (invoiceViewPermission && !finalPermissions.includes(invoiceViewPermission.id)) {
            finalPermissions.push(invoiceViewPermission.id);
          }
        }
        // Note: We don't remove explicit permissions if user doesn't have report access
        // This allows users to have buyer.view and product.view independently
        
        const rolePermissions = finalPermissions.map(permissionId => ({
          roleId: role.id,
          permissionId,
        }));

        await RolePermission.bulkCreate(rolePermissions, { transaction });
      } else {
        // If no permissions are selected, ensure conditional permissions are also removed
        // This handles the case where user unchecks all permissions
        const allPermissions = await Permission.findAll();
        
        // Remove template permission if uploader is not selected
        const templatePermission = allPermissions.find(p => 
          p.name === 'invoice.template' || p.name === 'Download Invoice Template'
        );
        if (templatePermission) {
          await RolePermission.destroy({
            where: { 
              roleId: role.id, 
              permissionId: templatePermission.id 
            },
            transaction
          });
        }
        
        // Remove save permission if validate is not selected
        const savePermission = allPermissions.find(p => 
          p.name === 'invoice.save' || p.name === 'Save Invoice'
        );
        if (savePermission) {
          await RolePermission.destroy({
            where: { 
              roleId: role.id, 
              permissionId: savePermission.id 
            },
            transaction
          });
        }
        
        // Remove product.view, buyer.view, and invoice.view permissions if report is not selected
        const productViewPermission = allPermissions.find(p => 
          p.name === 'product.view' || p.name === 'View Products'
        );
        if (productViewPermission) {
          await RolePermission.destroy({
            where: { 
              roleId: role.id, 
              permissionId: productViewPermission.id 
            },
            transaction
          });
        }
        
        const buyerViewPermission = allPermissions.find(p => 
          p.name === 'buyer.view' || p.name === 'View Buyers'
        );
        if (buyerViewPermission) {
          await RolePermission.destroy({
            where: { 
              roleId: role.id, 
              permissionId: buyerViewPermission.id 
            },
            transaction
          });
        }
        
        const invoiceViewPermission = allPermissions.find(p => 
          p.name === 'invoice.view' || p.name === 'View Invoices'
        );
        if (invoiceViewPermission) {
          await RolePermission.destroy({
            where: { 
              roleId: role.id, 
              permissionId: invoiceViewPermission.id 
            },
            transaction
          });
        }
      }

      await transaction.commit();

      // Return updated role with permissions
      const updatedRole = await Role.findByPk(role.id, {
        include: [
          {
            model: Permission,
            as: "permissions",
            through: { attributes: [] },
          },
        ],
      });

      return updatedRole;
    } catch (error) {
      await transaction.rollback();
      console.error("Error updating role:", error);
      throw error;
    }
  }

  // Delete a role
  async deleteRole(roleId) {
    const transaction = await masterSequelize.transaction();
    
    try {
      // Find the role
      const role = await Role.findByPk(roleId);
      if (!role) {
        throw new Error("Role not found");
      }

      // Check if it's a system role
      if (role.isSystemRole) {
        throw new Error("Cannot delete system roles");
      }

      // Check if any users are assigned to this role
      const usersWithRole = await User.count({ where: { roleId: role.id } });
      if (usersWithRole > 0) {
        throw new Error("Cannot delete role that is assigned to users");
      }

      // Delete role permissions first
      await RolePermission.destroy({
        where: { roleId: role.id },
        transaction,
      });

      // Delete the role
      await role.destroy({ transaction });

      await transaction.commit();

      return { message: "Role deleted successfully" };
    } catch (error) {
      await transaction.rollback();
      console.error("Error deleting role:", error);
      throw error;
    }
  }

  // Get role by ID
  async getRoleById(roleId) {
    try {
      const role = await Role.findByPk(roleId, {
        include: [
          {
            model: Permission,
            as: "permissions",
            through: { attributes: [] },
          },
        ],
      });

      if (!role) {
        throw new Error("Role not found");
      }

      return role;
    } catch (error) {
      console.error("Error fetching role:", error);
      throw error;
    }
  }

  // Check if user has permission
  async userHasPermission(userId, permissionName, userEmail = null) {
    try {
      // If email is provided, check by email to avoid ID conflicts
      if (userEmail) {
        // First check if this is an admin user by email
        const adminUser = await AdminUser.findOne({ where: { email: userEmail } });
        if (adminUser) {
          // Admin users have all permissions
          return true;
        }

        // Check regular users with roles by email
        const user = await User.findOne({
          where: { email: userEmail },
          include: [
            {
              model: Role,
              as: "userRole",
              include: [
                {
                  model: Permission,
                  as: "permissions",
                  where: {
                    name: permissionName,
                    isActive: true,
                  },
                  required: false,
                  through: { attributes: [] },
                },
              ],
            },
          ],
        });

        if (!user || !user.userRole) {
          return false;
        }

        // If user has a system role with all permissions, grant access
        if (user.userRole.isSystemRole === true) {
          return true;
        }

        // Check if user's role has the required permission
        const hasPermission = user.userRole.permissions.length > 0;
        return hasPermission;
      }

      // Fallback: check by ID (legacy behavior)
      // First check if this is an admin user
      const adminUser = await AdminUser.findByPk(userId);
      if (adminUser) {
        // Admin users have all permissions
        return true;
      }

      // Check regular users with roles
      const user = await User.findByPk(userId, {
        include: [
          {
            model: Role,
            as: "userRole",
            include: [
              {
                model: Permission,
                as: "permissions",
                where: {
                  name: permissionName,
                  isActive: true,
                },
                required: false,
                through: { attributes: [] },
              },
            ],
          },
        ],
      });

      if (!user || !user.userRole) {
        return false;
      }

      // If user has a system role with all permissions, grant access
      if (user.userRole.isSystemRole === true) {
        return true;
      }

      // Check if user's role has the required permission
      const hasPermission = user.userRole.permissions.length > 0;

      return hasPermission;
    } catch (error) {
      console.error("Error checking user permission:", error);
      return false;
    }
  }

  // Get user permissions
  async getUserPermissions(userId, userEmail = null) {
    try {
      // If email is provided, check by email to avoid ID conflicts
      if (userEmail) {
        // First check if this is an admin user by email
        const adminUser = await AdminUser.findOne({ where: { email: userEmail } });
        if (adminUser) {
          // Admin users have all permissions - return all active permissions
          const allPermissions = await Permission.findAll({
            where: { isActive: true }
          });
          return allPermissions;
        }

        // Check regular users with roles by email
        const user = await User.findOne({
          where: { email: userEmail },
          include: [
            {
              model: Role,
              as: "userRole",
              include: [
                {
                  model: Permission,
                  as: "permissions",
                  through: { attributes: [] },
                },
              ],
            },
          ],
        });

        if (!user || !user.userRole) {
          return [];
        }

        // If user has a system role, return all active permissions
        if (user.userRole.isSystemRole === true) {
          const allPermissions = await Permission.findAll({
            where: { isActive: true }
          });
          return allPermissions;
        }

        return user.userRole.permissions;
      }

      // Fallback: check by ID (legacy behavior)
      // First check if this is an admin user
      const adminUser = await AdminUser.findByPk(userId);
      if (adminUser) {
        // Admin users have all permissions - return all active permissions
        const allPermissions = await Permission.findAll({
          where: { isActive: true }
        });
        return allPermissions;
      }

      // Check regular users with roles
      const user = await User.findByPk(userId, {
        include: [
          {
            model: Role,
            as: "userRole",
            include: [
              {
                model: Permission,
                as: "permissions",
                through: { attributes: [] },
              },
            ],
          },
        ],
      });

      if (!user || !user.userRole) {
        return [];
      }

      // If user has a system role, return all active permissions
      if (user.userRole.isSystemRole === true) {
        const allPermissions = await Permission.findAll({
          where: { isActive: true }
        });
        return allPermissions;
      }

      return user.userRole.permissions;
    } catch (error) {
      console.error("Error fetching user permissions:", error);
      return [];
    }
  }
}

export default new RoleManagementService();