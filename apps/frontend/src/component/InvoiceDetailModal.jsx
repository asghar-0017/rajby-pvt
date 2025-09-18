import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Divider,
  IconButton,
  Stack,
  Card,
  CardContent,
} from '@mui/material';
import {
  Close as CloseIcon,
  Print as PrintIcon,
  Edit as EditIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import dayjs from 'dayjs';

const InvoiceDetailModal = ({ open, onClose, invoice }) => {
  if (!invoice) return null;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    return date ? dayjs(date).format('DD-MM-YYYY') : '-';
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'posted':
        return 'success';
      case 'draft':
        return 'warning';
      case 'cancelled':
        return 'error';
      case 'saved':
        return 'info';
      case 'validated':
        return 'primary';
      default:
        return 'default';
    }
  };

  const calculateItemTotal = (item) => {
    const quantity = parseFloat(item.quantity) || 0;
    const unitPrice = parseFloat(item.unitPrice) || 0;
    return quantity * unitPrice;
  };

  const calculateTaxAmount = (item) => {
    const itemTotal = calculateItemTotal(item);
    const taxRate = parseFloat(item.taxRate) || 0;
    return (itemTotal * taxRate) / 100;
  };

  const calculateTotalWithTax = (item) => {
    const itemTotal = calculateItemTotal(item);
    const taxAmount = calculateTaxAmount(item);
    return itemTotal + taxAmount;
  };

  const totalInvoiceAmount = invoice.invoiceItems?.reduce((sum, item) => {
    return sum + calculateTotalWithTax(item);
  }, 0) || 0;

  const totalTaxAmount = invoice.invoiceItems?.reduce((sum, item) => {
    return sum + calculateTaxAmount(item);
  }, 0) || 0;

  const totalWithoutTax = totalInvoiceAmount - totalTaxAmount;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { minHeight: '80vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h5" component="div" sx={{ fontWeight: 'bold' }}>
            Invoice Details
          </Typography>
          <Box>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Grid container spacing={3}>
          {/* Invoice Header Information */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                      Invoice Information
                    </Typography>
                    <Stack spacing={1}>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="textSecondary">
                          Invoice Number:
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {invoice.internalInvoiceNo || invoice.invoice_number || '-'}
                        </Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="textSecondary">
                          Company Invoice #:
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {invoice.companyInvoiceNo || invoice.companyInvoiceRefNo || '-'}
                        </Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="textSecondary">
                          FBR Invoice #:
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {invoice.fbr_invoice_number || '-'}
                        </Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="textSecondary">
                          Invoice Date:
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {formatDate(invoice.invoiceDate)}
                        </Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="textSecondary">
                          Status:
                        </Typography>
                        <Chip
                          label={invoice.status?.toUpperCase() || 'DRAFT'}
                          color={getStatusColor(invoice.status)}
                          size="small"
                        />
                      </Box>
                    </Stack>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                      Business Information
                    </Typography>
                    <Stack spacing={1}>
                      <Box>
                        <Typography variant="body2" color="textSecondary">
                          Seller:
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {invoice.sellerBusinessName || '-'}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          NTN: {invoice.sellerNTN || '-'}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="textSecondary">
                          Buyer:
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {invoice.buyerBusinessName || '-'}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          NTN: {invoice.buyerNTN || '-'}
                        </Typography>
                      </Box>
                    </Stack>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Invoice Items Table */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
              Invoice Items
            </Typography>
            <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>S.No</TableCell>
                    <TableCell>Product Description</TableCell>
                    <TableCell>HS Code</TableCell>
                    <TableCell>UOM</TableCell>
                    <TableCell align="right">Quantity</TableCell>
                    <TableCell align="right">Unit Price</TableCell>
                    <TableCell align="right">Item Total</TableCell>
                    <TableCell align="right">Tax Rate (%)</TableCell>
                    <TableCell align="right">Tax Amount</TableCell>
                    <TableCell align="right">Total with Tax</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invoice.invoiceItems?.map((item, index) => {
                    const itemTotal = calculateItemTotal(item);
                    const taxAmount = calculateTaxAmount(item);
                    const totalWithTax = calculateTotalWithTax(item);

                    return (
                      <TableRow key={index} hover>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ maxWidth: 200 }}>
                            {item.productDescription || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {item.hsCode || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {item.uom || item.unitOfMeasure || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">
                            {parseFloat(item.quantity || 0).toFixed(2)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">
                            {formatCurrency(item.unitPrice)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {formatCurrency(itemTotal)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">
                            {parseFloat(item.taxRate || 0).toFixed(2)}%
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" color="error.main">
                            {formatCurrency(taxAmount)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                            {formatCurrency(totalWithTax)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>

          {/* Invoice Summary */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                      Additional Information
                    </Typography>
                    <Stack spacing={1}>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="textSecondary">
                          Invoice Type:
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {invoice.invoiceType || '-'}
                        </Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="textSecondary">
                          Document Type:
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {invoice.documentType || '-'}
                        </Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="textSecondary">
                          Created By:
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {invoice.createdBy || invoice.created_by_email || '-'}
                        </Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="textSecondary">
                          Created Date:
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {formatDate(invoice.created_at)}
                        </Typography>
                      </Box>
                    </Stack>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                      Financial Summary
                    </Typography>
                    <Stack spacing={1}>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="textSecondary">
                          Subtotal (Before Tax):
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {formatCurrency(totalWithoutTax)}
                        </Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="textSecondary">
                          Total Tax Amount:
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                          {formatCurrency(totalTaxAmount)}
                        </Typography>
                      </Box>
                      <Divider />
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="h6" color="primary.main">
                          Grand Total:
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                          {formatCurrency(totalInvoiceAmount)}
                        </Typography>
                      </Box>
                    </Stack>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* FBR Information */}
          {(invoice.fbr_invoice_number || invoice.fbr_status) && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                    FBR Integration Details
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Stack spacing={1}>
                        <Box display="flex" justifyContent="space-between">
                          <Typography variant="body2" color="textSecondary">
                            FBR Status:
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {invoice.fbr_status || '-'}
                          </Typography>
                        </Box>
                        <Box display="flex" justifyContent="space-between">
                          <Typography variant="body2" color="textSecondary">
                            FBR Response:
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {invoice.fbr_response || '-'}
                          </Typography>
                        </Box>
                      </Stack>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Stack spacing={1}>
                        <Box display="flex" justifyContent="space-between">
                          <Typography variant="body2" color="textSecondary">
                            Submitted Date:
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {formatDate(invoice.fbr_submitted_date)}
                          </Typography>
                        </Box>
                        <Box display="flex" justifyContent="space-between">
                          <Typography variant="body2" color="textSecondary">
                            Last Updated:
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {formatDate(invoice.updated_at)}
                          </Typography>
                        </Box>
                      </Stack>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      </DialogContent>

      <DialogActions>
        <Button
          startIcon={<PrintIcon />}
          variant="outlined"
          onClick={() => {
            // Handle print functionality
            window.print();
          }}
        >
          Print
        </Button>
        <Button
          startIcon={<DownloadIcon />}
          variant="outlined"
          onClick={() => {
            // Handle download functionality
            console.log('Download invoice');
          }}
        >
          Download
        </Button>
        <Button
          startIcon={<EditIcon />}
          variant="outlined"
          onClick={() => {
            // Handle edit functionality
            console.log('Edit invoice');
          }}
        >
          Edit
        </Button>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default InvoiceDetailModal;
