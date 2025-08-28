import { DataTypes } from "sequelize";

export const createProductModel = (sequelize) => {
  return sequelize.define(
    "Product",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      hsCode: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      uom: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
    },
    {
      tableName: "products",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );
};
