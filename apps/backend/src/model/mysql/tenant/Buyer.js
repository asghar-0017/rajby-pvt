import { DataTypes } from 'sequelize';

// This will be used as a factory function to create Buyer model for each tenant
export const createBuyerModel = (sequelize) => {
  const Buyer = sequelize.define('Buyer', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    buyerId: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'buyer_id',
      validate: {
        len: [0, 50]
      }
    },
    buyerMainName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'buyer_main_name',
      validate: {
        len: [0, 255]
      }
    },
    buyerNTNCNIC: {
      type: DataTypes.STRING(50),
      allowNull: true,
      // Removed unique constraint - using composite key check in controller instead
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
    buyerCity: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'buyer_city',
      validate: {
        len: [0, 100]
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
    buyerPhoneNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'buyer_phone_number',
      validate: {
        len: [0, 20]
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
      // Index on buyerBusinessName for business name searches
      {
        name: 'idx_buyer_business_name',
        fields: ['buyerBusinessName']
      },
      // Composite index for duplicate checking (all fields must match)
      {
        name: 'idx_buyer_composite',
        fields: ['buyerId', 'buyerMainName', 'buyerBusinessName', 'buyerNTNCNIC', 'buyerProvince', 'buyerAddress']
      }
    ]
  });

  return Buyer;
}; 