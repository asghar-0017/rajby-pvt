# Remove Internal Invoice No Column from Excel Template

## Overview

The `Internal Invoice No` column has been removed from the Excel invoice template as it is no longer needed for invoice grouping functionality. All invoice grouping is now handled using the `Company Invoice Ref No` field.

## Changes Made

### 1. Backend Excel Template Generation

**File**: `apps/backend/src/controller/mysql/invoiceController.js`

- **Removed** `"internalInvoiceNo"` from the `columns` array in `downloadInvoiceTemplateExcel` function
- **Removed** `internalInvoiceNo: "Internal Invoice No"` from the `displayLabelMap` object

**Before**:

```javascript
const columns = [
  "invoiceType",
  "invoiceDate",
  "invoiceRefNo",
  "companyInvoiceRefNo",
  "internalInvoiceNo", // ❌ Removed
  // ... other columns
];

const displayLabelMap = {
  // ... other mappings
  internalInvoiceNo: "Internal Invoice No", // ❌ Removed
  // ... other mappings
};
```

**After**:

```javascript
const columns = [
  "invoiceType",
  "invoiceDate",
  "invoiceRefNo",
  "companyInvoiceRefNo",
  // ✅ internalInvoiceNo removed
  // ... other columns
];

const displayLabelMap = {
  // ... other mappings
  // ✅ internalInvoiceNo mapping removed
  // ... other mappings
};
```

### 2. Frontend Column Definitions

**File**: `apps/frontend/src/component/InvoiceUploader.jsx`

- **Removed** `"internalInvoiceNo"` from the `expectedColumns` array
- **Removed** `"Internal Invoice No": "internalInvoiceNo"` from the `displayToInternalHeaderMap` object

**Before**:

```javascript
const expectedColumns = [
  "invoiceType",
  "invoiceDate",
  "invoiceRefNo",
  "companyInvoiceRefNo",
  "internalInvoiceNo", // ❌ Removed
  // ... other columns
];

const displayToInternalHeaderMap = {
  // ... other mappings
  "Internal Invoice No": "internalInvoiceNo", // ❌ Removed
  // ... other mappings
};
```

**After**:

```javascript
const expectedColumns = [
  "invoiceType",
  "invoiceDate",
  "invoiceRefNo",
  "companyInvoiceRefNo",
  // ✅ internalInvoiceNo removed
  // ... other columns
];

const displayToInternalHeaderMap = {
  // ... other mappings
  // ✅ Internal Invoice No mapping removed
  // ... other mappings
};
```

### 3. Documentation Updates

**File**: `INVOICE_GROUPING_FEATURE.md`

- **Updated** the invoice structure example to remove `internalInvoiceNo`
- **Added** a note explaining that the column has been removed from the Excel template

## Impact

### What This Means

1. **Excel Template**: Users will no longer see the "Internal Invoice No" column when downloading the invoice template
2. **File Upload**: The system will no longer expect or process the "Internal Invoice No" column from uploaded Excel files
3. **Invoice Grouping**: All grouping continues to work using the `Company Invoice Ref No` field as implemented previously

### What Remains Unchanged

1. **Database**: The `internalInvoiceNo` field remains in the database schema for existing data
2. **Backend Processing**: The backend still processes `internalInvoiceNo` if it's provided in other ways (e.g., API calls)
3. **Existing Invoices**: All existing invoices with `internalInvoiceNo` values remain intact

## Benefits

1. **Simplified Template**: Users no longer need to fill in a field that isn't used for grouping
2. **Reduced Confusion**: Eliminates the potential confusion between `Internal Invoice No` and `Company Invoice Ref No`
3. **Cleaner Interface**: The Excel template is now more focused on the essential fields needed for invoice creation

## Testing Recommendations

1. **Download Template**: Verify that the Excel template no longer contains the "Internal Invoice No" column
2. **Upload Files**: Test uploading Excel files without the "Internal Invoice No" column to ensure they process correctly
3. **Grouping**: Verify that invoice grouping still works correctly using only the `Company Invoice Ref No` field
4. **Existing Data**: Ensure that existing invoices with `internalInvoiceNo` values are not affected

## Technical Notes

- The `internalInvoiceNo` field is still referenced in some backend code for database operations and API responses
- This change only affects the Excel template generation and frontend column expectations
- The invoice grouping logic was already updated in the previous change to use `companyInvoiceRefNo`
- No database schema changes are required for this update
