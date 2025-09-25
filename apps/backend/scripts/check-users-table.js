#!/usr/bin/env node

import { createConnection } from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: process.env.MYSQL_PORT || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'Jsab43#%87dgDJ49bf^9b',
  database: process.env.MYSQL_MASTER_DB || 'fbr_master'
};

async function checkUsersTable() {
  const connection = await createConnection(dbConfig);
  
  console.log('Users table columns:');
  const [columns] = await connection.execute('SHOW COLUMNS FROM users');
  columns.forEach(col => console.log(`  - ${col.Field} (${col.Type})`));
  
  console.log('\nUsers table data (first 5 rows):');
  const [users] = await connection.execute('SELECT * FROM users LIMIT 5');
  console.log(users);
  
  await connection.end();
}

checkUsersTable().catch(console.error);
