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

async function fixSpecificRecord() {
  const connection = await createConnection(dbConfig);
  
  // Update the backup summary with correct invoice number
  await connection.execute('UPDATE invoice_backup_summary SET invoice_number = ? WHERE id = 4', ['DRAFT_000003']);
  
  console.log('Fixed backup summary record');
  
  // Verify the fix
  const [summary] = await connection.execute('SELECT * FROM invoice_backup_summary WHERE id = 4');
  console.log('Updated record:');
  console.log(`Invoice Number: ${summary[0].invoice_number}`);
  console.log(`System Invoice ID: ${summary[0].system_invoice_id}`);
  console.log(`Tenant Name: ${summary[0].tenant_name}`);
  console.log(`Created By: ${summary[0].created_by_name}`);
  console.log(`Last Modified By: ${summary[0].last_modified_by_name}`);
  
  await connection.end();
}

fixSpecificRecord().catch(console.error);
