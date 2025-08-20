# Submit Button Flow Implementation

## Overview

The submit button now follows a two-step process to ensure data integrity and proper FBR integration.

## Flow Steps

### Step 1: FBR API Call

- **Endpoint**: `POST https://gw.fbr.gov.pk/dist/v1/di_data/v1/di/postinvoicedata`
- **Purpose**: Submit invoice data to FBR and get the official invoice number
- **Response**: FBR returns an invoice number (or relevant ID) on success

### Step 2: Backend API Call

- **Endpoint**: `POST https://hubpoly-packages.inplsoftwares.online/api/tenant/{tenant_id}/invoices`
- **Purpose**: Save the invoice data to the local database with the FBR invoice number
- **Request Body**: Includes all invoice details plus `fbr_invoice_number` from Step 1

### Step 3: Delete Saved Invoice

- **Endpoint**: `DELETE https://hubpoly-packages.inplsoftwares.online/api/tenant/{tenant_id}/invoices/{saved_invoice_id}`
- **Purpose**: Remove the temporary saved invoice from the system after successful submission
- **Condition**: Only executed if there was a previously saved invoice (editingId exists)

### Step 4: Success/Failure Handling

- **Success**: Shows "Invoice submitted successfully" with FBR invoice number
- **Failure**: Shows specific error message for either FBR or backend failure

## Implementation Details

### Frontend Changes

- Modified `handleSubmitChange` function in `createInvoiceForm.jsx`
- Added proper error handling for both API calls
- Enhanced logging for debugging

### Backend Support

- `createInvoice` function already supports `fbr_invoice_number` parameter
- Database stores both local invoice number and FBR invoice number
- Status is set to 'posted' when invoice is successfully submitted

## Error Handling

### FBR API Failures

- Validation errors from FBR
- Network connectivity issues
- Invalid token or authentication issues
- Malformed data errors

### Backend API Failures

- Database connection issues
- Data validation errors
- Duplicate invoice number conflicts
- Tenant authentication issues

## Benefits

1. **Data Integrity**: Ensures FBR submission before local storage
2. **Audit Trail**: Maintains both local and FBR invoice numbers
3. **Error Recovery**: Clear error messages for troubleshooting
4. **Consistency**: All submitted invoices have valid FBR numbers
5. **Clean System**: Automatically removes temporary saved invoices after successful submission
6. **No Duplicates**: Prevents accumulation of draft/saved invoices in the system

## Usage

1. Fill out the invoice form
2. Click "Save & Validate" to validate with FBR
3. Click "Submit" to execute the two-step submission process
4. Review success/error messages
5. Navigate to invoice list or create new invoice
