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
      itemId: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'item_id',
      },
      itemCode: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'item_code',
      },
      type: {
        type: DataTypes.STRING(100),
        allowNull: true,
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
      // Creator tracking
      created_by_user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      created_by_email: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      created_by_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
    },
    {
      tableName: "products",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        {
          unique: true,
          fields: ['item_id', 'item_code'],
          name: 'unique_item_id_item_code',
        },
      ],
    }
  );
};
