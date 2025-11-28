const mysql = require("mysql2/promise");
require("dotenv").config();

async function testPermissions() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "157.245.150.54",
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "Jsab43#%87dgDJ49bf^9b",
    database: process.env.MYSQL_MASTER_DB || "fbr_integration",
    port: process.env.MYSQL_PORT || 3306,
  });

  console.log("=== Current Permissions After Cleanup ===");
  const [permissions] = await connection.execute(
    'SELECT id, name, description FROM permissions WHERE name LIKE "%buyer%" OR name LIKE "%product%" OR name LIKE "%invoice%" ORDER BY name'
  );
  permissions.forEach((p) =>
    console.log(`ID: ${p.id}, Name: ${p.name}, Description: ${p.description}`)
  );

  console.log("\n=== User Role Permissions ===");
  const [userRolePerms] = await connection.execute(
    'SELECT p.name as permission_name FROM roles r JOIN role_permissions rp ON r.id = rp.role_id JOIN permissions p ON rp.permission_id = p.id WHERE r.name = "user" ORDER BY p.name'
  );
  console.log("User role permissions:");
  userRolePerms.forEach((rp) => console.log(`- ${rp.permission_name}`));

  await connection.end();
}

testPermissions().catch(console.error);
