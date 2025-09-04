import AdminUser from "./AdminUser.js";
import AdminSession from "./AdminSession.js";
import Tenant from "./Tenant.js";
import User from "./User.js";
import UserTenantAssignment from "./UserTenantAssignment.js";

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

export { AdminUser, AdminSession, Tenant, User, UserTenantAssignment };
