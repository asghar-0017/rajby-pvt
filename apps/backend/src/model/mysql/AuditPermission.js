import { DataTypes } from "sequelize";
import { masterSequelize } from "../../config/mysql.js";

const AuditPermission = masterSequelize.define(
  "AuditPermission",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    permissionName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      field: "permission_name",
    },
    displayName: {
      type: DataTypes.STRING(200),
      allowNull: false,
      field: "display_name",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: "is_active",
    },
  },
  {
    tableName: "audit_permissions",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export default AuditPermission;
