import { DataTypes } from "sequelize";
import { masterSequelize } from "../../config/mysql.js";

const UserTenantAssignment = masterSequelize.define(
  "UserTenantAssignment",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "user_id",
      references: {
        model: "users",
        key: "id",
      },
    },
    tenantId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "tenant_id",
      references: {
        model: "tenants",
        key: "id",
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: "is_active",
    },
    assignedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "assigned_by",
      references: {
        model: "admin_users",
        key: "id",
      },
    },
    assignedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "assigned_at",
    },
  },
  {
    tableName: "user_tenant_assignments",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        name: "idx_user_tenant_user",
        fields: ["user_id"],
      },
      {
        name: "idx_user_tenant_tenant",
        fields: ["tenant_id"],
      },
      {
        name: "idx_user_tenant_active",
        fields: ["is_active"],
      },
      {
        name: "idx_user_tenant_unique",
        fields: ["user_id", "tenant_id"],
        unique: true,
      },
    ],
  }
);

export default UserTenantAssignment;
