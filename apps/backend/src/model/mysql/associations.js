import AdminUser from "./AdminUser.js";
import AdminSession from "./AdminSession.js";
import Tenant from "./Tenant.js";
import User from "./User.js";
import UserTenantAssignment from "./UserTenantAssignment.js";
import Role from "./Role.js";
import Permission from "./Permission.js";
import RolePermission from "./RolePermission.js";
import AuditLog from "./AuditLog.js";
import AuditSummary from "./AuditSummary.js";
import AuditPermission from "./AuditPermission.js";

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

// Audit associations
User.hasMany(AuditLog, { foreignKey: "userId", as: "auditLogs" });
AuditLog.belongsTo(User, { foreignKey: "userId", as: "user" });

Tenant.hasMany(AuditLog, { foreignKey: "tenantId", as: "auditLogs" });
AuditLog.belongsTo(Tenant, { foreignKey: "tenantId", as: "tenant" });

User.hasMany(AuditSummary, { foreignKey: "createdByUserId", as: "createdAuditSummaries" });
AuditSummary.belongsTo(User, { foreignKey: "createdByUserId", as: "createdByUser" });

User.hasMany(AuditSummary, { foreignKey: "lastModifiedByUserId", as: "modifiedAuditSummaries" });
AuditSummary.belongsTo(User, { foreignKey: "lastModifiedByUserId", as: "lastModifiedByUser" });

User.hasMany(AuditSummary, { foreignKey: "deletedByUserId", as: "deletedAuditSummaries" });
AuditSummary.belongsTo(User, { foreignKey: "deletedByUserId", as: "deletedByUser" });

Tenant.hasMany(AuditSummary, { foreignKey: "tenantId", as: "auditSummaries" });
AuditSummary.belongsTo(Tenant, { foreignKey: "tenantId", as: "tenant" });

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
  RolePermission,
  AuditLog,
  AuditSummary,
  AuditPermission
};