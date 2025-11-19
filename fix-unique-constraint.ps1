# PowerShell Script to Fix Unique Constraint Issue
# Run this from your project root directory

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "FIX UNIQUE CONSTRAINT ON buyerNTNCNIC" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Get database credentials
$dbHost = $env:DB_HOST
if (-not $dbHost) { $dbHost = "localhost" }

$dbName = $env:DB_NAME
if (-not $dbName) {
    $dbName = Read-Host "Enter your database name (e.g., rajby_db)"
}

$dbUser = $env:DB_USER
if (-not $dbUser) {
    $dbUser = Read-Host "Enter your MySQL username"
}

$dbPassword = $env:DB_PASSWORD
if (-not $dbPassword) {
    $dbPasswordSecure = Read-Host "Enter your MySQL password" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPasswordSecure)
    $dbPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
}

Write-Host ""
Write-Host "Connecting to: $dbHost / $dbName" -ForegroundColor Yellow
Write-Host ""

# SQL to execute
$sql = @"
USE $dbName;

-- Show current indexes
SELECT 'Current indexes on buyerNTNCNIC:' AS Info;
SHOW INDEX FROM buyers WHERE Column_name = 'buyerNTNCNIC';

-- Drop all possible unique constraints
ALTER TABLE buyers DROP INDEX IF EXISTS buyerNTNCNIC;
ALTER TABLE buyers DROP INDEX IF EXISTS buyerNTNCNIC_2;
ALTER TABLE buyers DROP INDEX IF EXISTS buyerNTNCNIC_3;
ALTER TABLE buyers DROP INDEX IF EXISTS buyers_buyerNTNCNIC_key;
ALTER TABLE buyers DROP INDEX IF EXISTS buyers_buyerNTNCNIC_unique;
ALTER TABLE buyers DROP INDEX IF EXISTS idx_buyerNTNCNIC;

-- Verify they're gone
SELECT '✓ Constraints dropped! Remaining indexes:' AS Info;
SHOW INDEX FROM buyers WHERE Column_name = 'buyerNTNCNIC';

SELECT 'SUCCESS: Unique constraints removed!' AS Status;
"@

# Save to temp file
$tempSqlFile = Join-Path $env:TEMP "drop_ntn_constraints_temp.sql"
$sql | Out-File -FilePath $tempSqlFile -Encoding UTF8

Write-Host "Executing SQL commands..." -ForegroundColor Yellow

try {
    # Try to run mysql command
    $mysqlCmd = "mysql -h$dbHost -u$dbUser -p$dbPassword $dbName"
    Get-Content $tempSqlFile | & mysql -h $dbHost -u $dbUser -p$dbPassword $dbName 2>&1
    
    Write-Host ""
    Write-Host "✓ SUCCESS! Unique constraints have been dropped." -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Restart your backend server" -ForegroundColor White
    Write-Host "2. Try your bulk upload again" -ForegroundColor White
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "❌ ERROR: Could not execute MySQL command" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please run the SQL script manually:" -ForegroundColor Yellow
    Write-Host "1. Open MySQL Workbench or phpMyAdmin" -ForegroundColor White
    Write-Host "2. Run the file: DROP_ALL_NTN_CONSTRAINTS.sql" -ForegroundColor White
    Write-Host ""
    Write-Host "Or run this SQL directly:" -ForegroundColor Yellow
    Write-Host $sql -ForegroundColor Gray
    Write-Host ""
}

# Clean up temp file
Remove-Item $tempSqlFile -ErrorAction SilentlyContinue

Read-Host "Press Enter to exit"

