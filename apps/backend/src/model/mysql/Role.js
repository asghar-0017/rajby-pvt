import { DataTypes } from "sequelize";
import { masterSequelize } from "../../config/mysql.js";

const Role = masterSequelize.define(
  "Role",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        len: [1, 50],
      },
    },
    displayName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: "display_name",
      validate: {
        notEmpty: true,
        len: [1, 100],
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isSystemRole: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "is_system_role",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: "is_active",
    },
  // createdBy: {
  //   type: DataTypes.INTEGER,
  //   allowNull: true,
  //   field: "created_by",
  //   references: {
  //     model: "admin_users",
  //     key: "id",
  //   },
  // },
  },
  {
    tableName: "roles",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["name"],
      },
      {
        fields: ["is_system_role"],
      },
    ],
  }
);

export default Role;