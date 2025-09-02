# Company Invoice Ref No Grouping Implementation

## Overview

This document outlines the changes made to implement invoice grouping by `companyInvoiceRefNo` instead of `internalInvoiceNo` in the Excel sheet uploader functionality.

## Changes Made

### 1. Frontend Changes (InvoiceUploader.jsx)

#### A. Grouping Logic Update

- **File**: `apps/frontend/src/component/InvoiceUploader.jsx`
- **Lines**: 1050-1120
- **Change**: Modified the grouping logic to use `companyInvoiceRefNo` instead of `internalInvoiceNo`
- **Details**:
  - Changed grouping key from `internalInvoiceNo` to `companyInvoiceRefNo`
  - Updated all references in the grouping Map operations
  - Modified error messages to reflect the new grouping field
  - Kept `internalInvoiceNo` in the invoice data for reference purposes

#### B. Summary Display Updates

- **Lines**: 1720-1730, 1770-1780
- **Change**: Updated invoice count calculations to use `companyInvoiceRefNo`
- **Details**:
  - Modified the summary text to show count based on `companyInvoiceRefNo` grouping
  - Updated upload button text to reflect the new grouping logic

#### C. Debug Logging Updates

- **Lines**: 490-500, 1173-1185
- **Change**: Updated console.log statements to reflect new grouping field
- **Details**:
  - Changed debug logs to show `companyInvoiceRefNo` as primary grouping field
  - Kept `internalInvoiceNo` in logs for reference
  - Updated grouping summary to show both fields

#### D. Commented Preview Section

- **Lines**: 1450-1490
- **Change**: Updated commented-out preview section to use new grouping logic
- **Details**:
  - Changed preview title from "by internalInvoiceNo" to "by Company Invoice Ref No"
  - Updated all variable references in the commented code

### 2. Backend Changes (invoiceController.js)

#### A. Debug Logging Update

- **File**: `apps/backend/src/controller/mysql/invoiceController.js`
- **Lines**: 2540-2550
- **Change**: Updated debug logging to reflect new grouping field
- **Details**:
  - Changed console.log to show `companyInvoiceRefNo` instead of `internalInvoiceNo`
  - Maintained the same logging structure for consistency

### 3. Documentation Updates

#### A. INVOICE_GROUPING_FEATURE.md

- **File**: `INVOICE_GROUPING_FEATURE.md`
- **Changes**:
  - Updated row grouping logic description
  - Modified data consistency validation explanation
  - Updated example structure to show `companyInvoiceRefNo` as grouping field
  - Added comments explaining the change

## Technical Details

### Before (Internal Invoice No Grouping)

```javascript
// Old grouping logic
const internalInvoiceNo =
  cleanedItem.internalInvoiceNo?.trim() || `row_${index + 1}`;
if (groupedInvoices.has(internalInvoiceNo)) {
  // Group by internalInvoiceNo
}
```

### After (Company Invoice Ref No Grouping)

```javascript
// New grouping logic
const companyInvoiceRefNo =
  cleanedItem.companyInvoiceRefNo?.trim() || `row_${index + 1}`;
if (groupedInvoices.has(companyInvoiceRefNo)) {
  // Group by companyInvoiceRefNo
}
```

## Benefits of the Change

1. **Business Logic Alignment**: Company Invoice Ref No is more meaningful for business operations
2. **User Experience**: Users can now group invoices using their company's internal reference system
3. **Data Consistency**: Maintains the same validation and grouping capabilities
4. **Backward Compatibility**: `internalInvoiceNo` field is still preserved and logged for reference

## Impact

- **Excel Uploads**: Rows with the same `companyInvoiceRefNo` will now be grouped into single invoices
- **Invoice Creation**: Multiple line items can be combined into one invoice based on company reference
- **Data Validation**: Same consistency checks apply (invoice type, date, buyer details, etc.)
- **User Interface**: All displays and messages now reflect the new grouping logic

## Testing Recommendations

1. **Excel Upload Testing**: Test with Excel files containing different `companyInvoiceRefNo` values
2. **Grouping Validation**: Verify that rows with same `companyInvoiceRefNo` are properly grouped
3. **Error Handling**: Test consistency validation with mismatched invoice-level data
4. **Backward Compatibility**: Ensure existing `internalInvoiceNo` data is still preserved

## Notes

- The `internalInvoiceNo` field is still available and stored in the database
- All existing functionality remains intact
- The change only affects the grouping logic for Excel uploads
- No database schema changes are required
