# Buyer Upload Field Mapping Guide

## ⚠️ CRITICAL: Your JSON Field Names Are Incorrect

### Issue Found
Your current JSON uses these field names:
```json
{
  "buyerName": "...",
  "address": "...",
  "province": "...",
  "ntnno": "..."
}
```

### Required Field Names
The backend expects these field names:
```json
{
  "buyerBusinessName": "...",
  "buyerAddress": "...",
  "buyerProvince": "...",
  "buyerNTNCNIC": "..."
}
```

## ✅ Correct Format

Transform your JSON from:
```json
{
  "buyerId": "01001002001001",
  "buyerMainName": "Fabric",
  "buyerName": "Rajby Industries",              ❌ WRONG
  "address": "Plot 38,39 & 77,78 Sec-27...",    ❌ WRONG
  "province": "Sindh",                          ❌ WRONG
  "ntnno": "1431771-7"                          ❌ WRONG
}
```

To:
```json
{
  "buyerId": "01001002001001",
  "buyerMainName": "Fabric",
  "buyerBusinessName": "Rajby Industries",      ✅ CORRECT
  "buyerAddress": "Plot 38,39 & 77,78 Sec-27...", ✅ CORRECT
  "buyerProvince": "Sindh",                     ✅ CORRECT
  "buyerNTNCNIC": "1431771-7"                   ✅ CORRECT
}
```

## Complete Field Mapping

| Your Field Name | Required Field Name | Required? | Example |
|----------------|---------------------|-----------|---------|
| `buyerId` | `buyerId` | No | "01001002001001" |
| `buyerMainName` | `buyerMainName` | No | "Fabric" |
| `buyerName` ❌ | `buyerBusinessName` ✅ | No | "Rajby Industries" |
| `address` ❌ | `buyerAddress` ✅ | No | "Plot 38,39..." |
| `province` ❌ | `buyerProvince` ✅ | YES | "Sindh" or "Punjab" |
| `ntnno` ❌ | `buyerNTNCNIC` ✅ | No | "1431771-7" or "A917166" |
| - | `buyerRegistrationType` | YES | "Registered" or "Unregistered" |

## NTN Format Changes

### ✅ Now Supports:
- **Numeric NTNs**: `1431771-7` → normalizes to `1431771`
- **Alphanumeric NTNs**: `A917166` → keeps as `A917166`
- **With dashes**: `F655242-6` → normalizes to `F655242`
- **With spaces**: `1505704 -6` → normalizes to `1505704`

### Validation Rules:
- NTN: **Exactly 7 alphanumeric characters** (letters A-Z, 0-9)
- CNIC: **Exactly 13 digits** (only numbers)

## Database Changes Applied

### ✅ Automatic Fixes (via auto-schema-sync.js):
1. ✅ Dropped unique constraint on `buyerNTNCNIC`
2. ✅ Created composite index for faster duplicate checking
3. ✅ Allows same NTN with different buyer details

### Composite Key Behavior:
- **ALL fields must match** to be considered duplicate:
  - `buyerId`
  - `buyerMainName`
  - `buyerBusinessName`
  - `buyerAddress`
  - `buyerProvince`
  - `buyerNTNCNIC`
- If **any field differs**, a new buyer is created

## Example: Same NTN, Different Buyers (✅ Allowed)

```json
[
  {
    "buyerId": "01001207001001",
    "buyerMainName": "Fabric",
    "buyerBusinessName": "Loft Commercials Limited.",
    "buyerAddress": "1/2 Km, Defense Road...",
    "buyerProvince": "Punjab",
    "buyerNTNCNIC": "4111664-0"
  },
  {
    "buyerId": "01001329001001",
    "buyerMainName": "Fabric",
    "buyerBusinessName": "Loftex Limited",
    "buyerAddress": "Plot No. 534 & 535...",
    "buyerProvince": "Punjab",
    "buyerNTNCNIC": "4111664-0"
  }
]
```

✅ **Both will be created** because `buyerBusinessName` and `buyerAddress` are different!

## Quick Fix Script

If you have a lot of JSON data, use this JavaScript to convert:

```javascript
const fixedData = yourData.map(buyer => ({
  buyerId: buyer.buyerId,
  buyerMainName: buyer.buyerMainName,
  buyerBusinessName: buyer.buyerName,      // Changed
  buyerAddress: buyer.address,             // Changed
  buyerProvince: buyer.province,           // Changed
  buyerNTNCNIC: buyer.ntnno,               // Changed
  buyerRegistrationType: "Registered"      // Add if missing
}));
```

## Next Steps

1. ✅ Fix your JSON field names (use the mapping above)
2. ✅ Add `buyerRegistrationType` field (Required: "Registered" or "Unregistered")
3. ✅ Upload again - should work now!

## Error Response Format

Now you'll get detailed errors with exact row numbers and buyer info:

```json
{
  "errors": [
    {
      "row": 18,
      "buyerId": "01001037001032",
      "buyerName": "Copper N Blues (Pvt) Ltd",
      "ntn": "917166",
      "error": "NTN must be 7 alphanumeric characters or CNIC must be 13 digits long"
    }
  ]
}
```

## Support

If you still encounter issues:
1. Check the exact error message in the response
2. Verify all field names match exactly
3. Ensure `buyerProvince` and `buyerRegistrationType` are present
4. Check NTN format (7 chars) or CNIC (13 digits)

