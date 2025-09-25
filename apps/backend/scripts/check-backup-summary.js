#!/usr/bin/env node

import { createConnection } from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: process.env.MYSQL_PORT || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'Jsab43#%87dgDJ49bf^9b',
  database: 'Innovative Networ'
};

async function checkBackupSummary() {
  const connection = await createConnection(dbConfig);
  
  console.log('Recent backup summaries:');
  const [summaries] = await connection.execute('SELECT * FROM invoice_backup_summary ORDER BY id DESC LIMIT 5');
  summaries.forEach(summary => {
    console.log(`ID: ${summary.id}, Invoice ID: ${summary.original_invoice_id}, Invoice Number: ${summary.invoice_number}, Tenant: ${summary.tenant_name}`);
    console.log(`  - Created By: ${summary.created_by_name} (${summary.created_by_email})`);
    console.log(`  - Last Modified By: ${summary.last_modified_by_name} (${summary.last_modified_by_email})`);
    console.log(`  - System Invoice ID: ${summary.system_invoice_id}`);
    console.log(`  - FBR Invoice Number: ${summary.fbr_invoice_number}`);
    console.log('');
  });
  
  await connection.end();
}

checkBackupSummary().catch(console.error);
