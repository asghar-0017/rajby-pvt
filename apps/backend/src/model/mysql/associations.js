import AdminUser from "./AdminUser.js";
import AdminSession from "./AdminSession.js";
import Tenant from "./Tenant.js";
import User from "./User.js";
import UserTenantAssignment from "./UserTenantAssignment.js";
import Role from "./Role.js";
import Permission from "./Permission.js";
import RolePermission from "./RolePermission.js";

// AdminUser associations
AdminUser.hasMany(AdminSession, { foreignKey: "admin_id" });
AdminSession.belongsTo(AdminUser, { foreignKey: "admin_id" });

// User associations
User.hasMany(UserTenantAssignment, { foreignKey: "userId" });
UserTenantAssignment.belongsTo(User, { foreignKey: "userId" });

// Tenant associations
Tenant.hasMany(UserTenantAssignment, { foreignKey: "tenantId" });
UserTenantAssignment.belongsTo(Tenant, { foreignKey: "tenantId" });

// AdminUser associations with User (for created_by)
AdminUser.hasMany(User, { foreignKey: "createdBy", as: "CreatedUsers" });
User.belongsTo(AdminUser, { foreignKey: "createdBy", as: "CreatedBy" });

// AdminUser associations with UserTenantAssignment (for assigned_by)
AdminUser.hasMany(UserTenantAssignment, {
  foreignKey: "assignedBy",
  as: "UserAssignments",
});
UserTenantAssignment.belongsTo(AdminUser, {
  foreignKey: "assignedBy",
  as: "AssignedBy",
});

// Role and Permission associations
Role.belongsToMany(Permission, {
  through: RolePermission,
  foreignKey: "roleId",
  otherKey: "permissionId",
  as: "permissions",
});

Permission.belongsToMany(Role, {
  through: RolePermission,
  foreignKey: "permissionId",
  otherKey: "roleId",
  as: "roles",
});

// User-Role associations
User.belongsTo(Role, { foreignKey: "roleId", as: "userRole" });
Role.hasMany(User, { foreignKey: "roleId", as: "users" });

// AdminUser associations with Role (for created_by) - commented out since created_by column doesn't exist
// AdminUser.hasMany(Role, { foreignKey: "createdBy", as: "CreatedRoles" });
// Role.belongsTo(AdminUser, { foreignKey: "createdBy", as: "CreatedBy" });

export { 
  AdminUser, 
  AdminSession, 
  Tenant, 
  User, 
  UserTenantAssignment, 
  Role, 
  Permission, 
  RolePermission 
};