import { masterSequelize } from '../src/config/mysql.js';

async function addRoleIdColumn() {
  try {
    console.log('🔧 Adding role_id column to users table...');
    
    // Check if column already exists
    const columns = await masterSequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME = 'role_id'
    `, { type: masterSequelize.QueryTypes.SELECT });
    
    if (columns && columns.length > 0) {
      console.log('✅ role_id column already exists in users table');
    } else {
      // Add the column
      await masterSequelize.query(`
        ALTER TABLE users 
        ADD COLUMN role_id int(11) DEFAULT NULL AFTER phone,
        ADD KEY idx_user_role_id (role_id),
        ADD CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE SET NULL
      `, { type: masterSequelize.QueryTypes.RAW });
      
      console.log('✅ Successfully added role_id column to users table');
    }
    
    // Verify the column exists
    const newColumns = await masterSequelize.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME = 'role_id'
    `, { type: masterSequelize.QueryTypes.SELECT });
    
    if (newColumns && newColumns.length > 0) {
      console.log('📋 Column details:', newColumns[0]);
    }
    
  } catch (error) {
    console.error('❌ Error adding role_id column:', error.message);
    throw error;
  } finally {
    await masterSequelize.close();
  }
}

addRoleIdColumn()
  .then(() => {
    console.log('🎉 Column addition completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Column addition failed:', error);
    process.exit(1);
  });
