import { DataTypes } from "sequelize";
import { masterSequelize } from "../../config/mysql.js";

const User = masterSequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    firstName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: "first_name",
    },
    lastName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: "last_name",
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    role: {
      type: DataTypes.ENUM("user", "admin"),
      defaultValue: "user",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: "is_active",
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "is_verified",
    },
    verifyToken: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "verify_token",
    },
    resetToken: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "reset_token",
    },
    resetTokenExpiry: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "reset_token_expiry",
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "created_by",
      references: {
        model: "admin_users",
        key: "id",
      },
    },
  },
  {
    tableName: "users",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        name: "idx_user_email",
        fields: ["email"],
        unique: true,
      },
      {
        name: "idx_user_role",
        fields: ["role"],
      },
      {
        name: "idx_user_active",
        fields: ["isActive"],
      },
    ],
  }
);

export default User;
