import { DataTypes } from 'sequelize';

// This will be used as a factory function to create Buyer model for each tenant
export const createBuyerModel = (sequelize) => {
  const Buyer = sequelize.define('Buyer', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    buyerNTNCNIC: {
      type: DataTypes.STRING(50),
      allowNull: true,
      unique: true, // Add unique constraint to prevent duplicate NTN
      validate: {
        len: [0, 50]
      }
    },
    buyerBusinessName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        len: [0, 255]
      }
    },
    buyerProvince: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 100]
      }
    },
    buyerAddress: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    buyerRegistrationType: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 100]
      }
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
    }
  }, {
    tableName: 'buyers',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      // Primary index on buyerNTNCNIC for ultra-fast lookups
      {
        name: 'idx_buyer_ntn_cnic',
        fields: ['buyerNTNCNIC'],
        unique: true
      },
      // Index on buyerBusinessName for business name searches
      {
        name: 'idx_buyer_business_name',
        fields: ['buyerBusinessName']
      },
      // Composite index for province-based queries
      {
        name: 'idx_buyer_province_ntn',
        fields: ['buyerProvince', 'buyerNTNCNIC']
      }
    ]
  });

  return Buyer;
}; 