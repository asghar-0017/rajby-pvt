import { DataTypes } from "sequelize";
import { masterSequelize } from "../../config/mysql.js";

const RolePermission = masterSequelize.define(
  "RolePermission",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    roleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "role_id",
      references: {
        model: "roles",
        key: "id",
      },
    },
    permissionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "permission_id",
      references: {
        model: "permissions",
        key: "id",
      },
    },
  },
  {
    tableName: "role_permissions",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false, // No updated_at for junction table
    indexes: [
      {
        fields: ["role_id"],
      },
      {
        fields: ["permission_id"],
      },
      {
        unique: true,
        fields: ["role_id", "permission_id"],
      },
    ],
  }
);

export default RolePermission;