#!/usr/bin/env node

/**
 * Add buyerTelephone Column Script
 * 
 * This script adds the missing buyerTelephone column to all tenant databases.
 */

import { masterSequelize, createTenantConnection } from '../src/config/mysql.js';
import Tenant from '../src/model/mysql/Tenant.js';

async function addBuyerTelephoneColumn() {
  try {
    console.log('🔍 Finding active tenants...');
    
    // Get active tenants
    const tenants = await Tenant.findAll({
      where: { is_active: true },
      attributes: ['id', 'database_name', 'seller_business_name']
    });

    console.log(`Found ${tenants.length} active tenants`);

    for (const tenant of tenants) {
      try {
        console.log(`\n📋 Processing tenant: ${tenant.seller_business_name} (${tenant.database_name})`);
        const tenantSequelize = createTenantConnection(tenant.database_name);
        await tenantSequelize.authenticate();
        
        // Check if invoices table exists
        const [tables] = await tenantSequelize.query(
          'SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = ?',
          { replacements: [tenant.database_name, 'invoices'] }
        );
        
        if (tables[0].count > 0) {
          // Check if buyerTelephone column exists
          const [columns] = await tenantSequelize.query(
            'SELECT COUNT(*) as count FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?',
            { replacements: [tenant.database_name, 'invoices', 'buyerTelephone'] }
          );
          
          if (columns[0].count === 0) {
            // Add the column
            await tenantSequelize.query('ALTER TABLE `invoices` ADD COLUMN `buyerTelephone` VARCHAR(20) NULL');
            console.log(`✅ Added buyerTelephone column to ${tenant.database_name}.invoices`);
          } else {
            console.log(`ℹ️ buyerTelephone column already exists in ${tenant.database_name}.invoices`);
          }
        } else {
          console.log(`⚠️ invoices table does not exist in ${tenant.database_name}`);
        }
        
        await tenantSequelize.close();
      } catch (error) {
        console.error(`❌ Error processing tenant ${tenant.database_name}: ${error.message}`);
      }
    }
    
    console.log('\n✅ Column addition process completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addBuyerTelephoneColumn();
