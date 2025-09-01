# Invoice Grouping Feature - Excel Sheet Uploader

## Overview

A new functionality has been added to the Excel Sheet Uploader that automatically groups rows by `internalInvoiceNo` and combines them into single invoices with multiple line items, exactly like the create invoice form.

## How It Works

### 1. Row Grouping Logic

- When an Excel sheet is uploaded, rows are automatically grouped by the `internalInvoiceNo` column
- Rows with the same `internalInvoiceNo` are combined into a single invoice
- Rows without an `internalInvoiceNo` are treated as separate invoices (with auto-generated row numbers)

### 2. Data Consistency Validation

- Before grouping, the system validates that rows with the same `internalInvoiceNo` have consistent invoice-level data:
  - Invoice Type
  - Invoice Date
  - Buyer NTN/CNIC
  - Buyer Business Name
  - Buyer Province
  - Buyer Address
  - Buyer Registration Type
- If inconsistencies are found, the upload is blocked with detailed error messages

### 3. Invoice Structure

Each grouped invoice maintains the same structure expected by the backend:

```javascript
{
  invoiceType: "Sale Invoice",
  invoiceDate: "2024-01-15",
  companyInvoiceRefNo: "COMP-001",
  internalInvoiceNo: "INV-001",
  buyerNTNCNIC: "123456789",
  buyerBusinessName: "ABC Company",
  buyerProvince: "Punjab",
  buyerAddress: "123 Main St",
  buyerRegistrationType: "Registered",
  items: [
    // Array of line items from the grouped rows
    { item_productName: "Product A", item_hsCode: "1234.56.78", ... },
    { item_productName: "Product B", item_hsCode: "8765.43.21", ... }
  ]
}
```

## User Experience Improvements

### 1. Visual Feedback

- **Grouping Preview**: Shows how rows will be grouped before upload
- **Invoice Count**: Displays the actual number of invoices (after grouping) vs total rows
- **Upload Button**: Shows the correct count of invoices to be created

### 2. Information Display

- Clear explanation of the new feature in the upload dialog
- Real-time preview of grouping results
- Error messages for data inconsistencies

### 3. Example Scenarios

#### Scenario 1: Multiple Items for Same Invoice

```
Row 1: internalInvoiceNo="INV-001", Product A
Row 2: internalInvoiceNo="INV-001", Product B
Row 3: internalInvoiceNo="INV-001", Product C
```

**Result**: 1 invoice with 3 line items

#### Scenario 2: Different Invoices

```
Row 1: internalInvoiceNo="INV-001", Product A
Row 2: internalInvoiceNo="INV-002", Product B
Row 3: internalInvoiceNo="INV-003", Product C
```

**Result**: 3 separate invoices with 1 line item each

#### Scenario 3: Mixed Scenario

```
Row 1: internalInvoiceNo="INV-001", Product A
Row 2: internalInvoiceNo="INV-001", Product B
Row 3: internalInvoiceNo="INV-002", Product C
Row 4: (no internalInvoiceNo), Product D
```

**Result**: 3 invoices total

- Invoice 1: 2 line items (Product A, Product B)
- Invoice 2: 1 line item (Product C)
- Invoice 3: 1 line item (Product D) - auto-generated row number

## Technical Implementation

### Frontend Changes

- **InvoiceUploader.jsx**: Modified `handleUpload` function to implement grouping logic
- **Data Processing**: Added row grouping, validation, and error handling
- **UI Updates**: Added grouping preview, updated counts, and user information

### Backend Compatibility

- The backend `bulkCreateInvoices` function already supports the grouped structure
- No backend changes required
- Maintains the same API contract

### Error Handling

- **Grouping Errors**: Validates data consistency across grouped rows
- **Validation Errors**: Prevents upload if critical data is missing or inconsistent
- **User Feedback**: Clear error messages with row numbers and specific issues

## Benefits

1. **Eliminates Manual Work**: Users no longer need to manually combine multiple rows into single invoices
2. **Maintains Data Integrity**: Ensures consistent invoice-level data across grouped items
3. **Improves User Experience**: Clear preview of how data will be processed
4. **Backward Compatible**: Existing functionality remains unchanged
5. **Flexible**: Handles both grouped and individual invoice scenarios

## Usage Instructions

1. **Prepare Excel Sheet**: Include `internalInvoiceNo` column with consistent values for rows that should be grouped
2. **Upload File**: Use the existing upload functionality
3. **Review Grouping**: Check the grouping preview to ensure rows are combined as expected
4. **Upload**: Proceed with upload - the system will automatically create the correct number of invoices

## Future Enhancements

- **Bulk Edit**: Allow users to modify grouping before upload
- **Template Validation**: Enhanced Excel template with grouping examples
- **Grouping Rules**: Configurable rules for automatic grouping
- **Preview Edit**: In-place editing of grouped invoices before upload
