import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Chip,
  Card,
  CardContent,
  Divider,
} from '@mui/material';
import {
  DatePicker,
  LocalizationProvider,
} from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import {
  FileDownload as DownloadIcon,
} from '@mui/icons-material';
import { useTenantSelection } from '../Context/TenantSelectionProvider';
import { api } from '../API/Api';
import { toast } from 'react-toastify';

const SalesReport = () => {
  const { selectedTenant } = useTenantSelection();
  const [startDate, setStartDate] = useState(dayjs().subtract(30, 'days'));
  const [endDate, setEndDate] = useState(dayjs());
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  const handleGenerateReport = async () => {
    if (!selectedTenant) {
      toast.error('Please select a company first');
      return;
    }

    if (!startDate || !endDate) {
      toast.error('Please select both start and end dates');
      return;
    }

    if (startDate.isAfter(endDate)) {
      toast.error('Start date cannot be after end date');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.get(
        `/tenant/${selectedTenant.tenant_id}/invoices`,
        {
          params: {
            start_date: startDate.format('YYYY-MM-DD'),
            end_date: endDate.format('YYYY-MM-DD'),
            limit: 1000, // Get all invoices in the date range
            include_details: true, // Include complete invoice details
            status: 'All', // Get all statuses
          },
        }
      );

      if (response.data.success) {
        const invoiceData = response.data.data.invoices || [];
        console.log('📊 Invoice Data Received:', invoiceData);
        console.log('📊 Total Invoices:', invoiceData.length);
        console.log('📊 First Invoice Sample:', invoiceData[0]);
        console.log('📊 Response Structure:', response.data);
        setInvoices(invoiceData);

        // Calculate summary
        const totalInvoices = invoiceData.length;
        const postedInvoices = invoiceData.filter(inv => inv.status === 'posted').length;
        const draftInvoices = invoiceData.filter(inv => inv.status === 'draft').length;
        const totalAmount = invoiceData.reduce((sum, inv) => {
          const invoiceTotal = inv.items?.reduce((itemSum, item) => 
            itemSum + (parseFloat(item.totalValues) || 0), 0) || 0;
          return sum + invoiceTotal;
        }, 0);

        setSummary({
          totalInvoices,
          postedInvoices,
          draftInvoices,
          totalAmount: totalAmount.toFixed(2),
        });

        toast.success(`Report generated successfully! Found ${totalInvoices} invoices.`);
      } else {
        setError(response.data.message || 'Failed to generate report');
      }
    } catch (error) {
      console.error('Error generating sales report:', error);
      setError(error.response?.data?.message || 'Error generating sales report');
    } finally {
      setLoading(false);
    }
  };


  const handleDownload = () => {
    // Create CSV data with all comprehensive columns
    const csvData = [
      [
        'S.No', 'Invoice Number', 'Company Invoice #', 'FBR Invoice #', 'Invoice Date', 
        'Status', 'Buyer Name', 'Buyer NTN', 'Seller Name', 
        'Product Descriptions', 'HS Codes', 'UOM', 'Qty', 'Unit Prices', 
        'Sales Tax Rate', 'ST Withheld', 'Extra Tax', 'Further Tax', 'FED Payable', 
        'Advance Income Tax', 'Discount', 'Subtotal', 'Tax Amount', 'Total Amount'
      ],
      ...invoices.map((invoice, index) => {
        const totalAmount = invoice.items?.reduce(
          (sum, item) => sum + (parseFloat(item.totalValues) || 0),
          0
        ) || 0;

        const subtotal = invoice.items?.reduce((sum, item) => {
          const quantity = parseFloat(item.quantity) || 0;
          const unitPrice = parseFloat(item.unitPrice) || 0;
          return sum + (quantity * unitPrice);
        }, 0) || 0;

        const taxAmount = invoice.items?.reduce((sum, item) => {
          const quantity = parseFloat(item.quantity) || 0;
          const unitPrice = parseFloat(item.unitPrice) || 0;
          const itemTotal = quantity * unitPrice;
          const taxRate = parseFloat(item.salesTaxApplicable || item.taxRate) || 0;
          return sum + (itemTotal * taxRate / 100);
        }, 0) || 0;

        const hsCodes = [...new Set(invoice.items?.map(item => item.hsCode).filter(Boolean) || [])];
        const uoms = [...new Set(invoice.items?.map(item => item.uoM || item.uom || item.unitOfMeasure).filter(Boolean) || [])];
        const productDescriptions = invoice.items?.map(item => item.productDescription).filter(Boolean) || [];
        const quantities = invoice.items?.map(item => parseFloat(item.quantity || 0).toFixed(2)) || [];
        const unitPrices = invoice.items?.map(item => parseFloat(item.unitPrice || 0).toFixed(2)) || [];
        const salesTypes = [...new Set(invoice.items?.map(item => item.saleType || item.salesType).filter(Boolean) || [])];
        const sroSchedules = [...new Set(invoice.items?.map(item => item.sroScheduleNo).filter(Boolean) || [])];
        const taxRates = [...new Set(invoice.items?.map(item => parseFloat(item.salesTaxApplicable || item.taxRate || 0).toFixed(2)).filter(rate => rate !== '0.00') || [])];

        const stWithheld = invoice.items?.reduce((sum, item) => sum + (parseFloat(item.stWithheld) || 0), 0) || 0;
        const extraTax = invoice.items?.reduce((sum, item) => sum + (parseFloat(item.extraTax) || 0), 0) || 0;
        const furtherTax = invoice.items?.reduce((sum, item) => sum + (parseFloat(item.furtherTax) || 0), 0) || 0;
        const fedPayable = invoice.items?.reduce((sum, item) => sum + (parseFloat(item.fedPayable) || 0), 0) || 0;
        const advanceIncomeTax = invoice.items?.reduce((sum, item) => sum + (parseFloat(item.advanceIncomeTax) || 0), 0) || 0;
        const discount = invoice.items?.reduce((sum, item) => sum + (parseFloat(item.discount) || 0), 0) || 0;

        return [
          index + 1,
          invoice.invoiceNumber || invoice.invoice_number || '',
          invoice.companyInvoiceRefNo || '',
          invoice.fbr_invoice_number || '',
          invoice.invoiceDate ? dayjs(invoice.invoiceDate).format('DD-MM-YYYY') : '',
          invoice.status || 'DRAFT',
          invoice.buyerBusinessName || '',
          invoice.buyerNTNCNIC || '',
          invoice.sellerBusinessName || '',
          productDescriptions.join(', '),
          hsCodes.join(', '),
          uoms.join(', '),
          quantities.join(', '),
          unitPrices.join(', '),
          taxRates.join(', ') + (taxRates.length > 0 ? '%' : ''),
          stWithheld.toFixed(2),
          extraTax.toFixed(2),
          furtherTax.toFixed(2),
          fedPayable.toFixed(2),
          advanceIncomeTax.toFixed(2),
          discount.toFixed(2),
          subtotal.toFixed(2),
          taxAmount.toFixed(2),
          totalAmount.toFixed(2)
        ];
      })
    ];

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sales-report-${startDate.format('YYYY-MM-DD')}-to-${endDate.format('YYYY-MM-DD')}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };


  const getStatusColor = (status) => {
    switch (status) {
      case 'posted':
        return 'success';
      case 'draft':
        return 'warning';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
    }).format(amount);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
        Sales Report
      </Typography>

      {/* Date Range Form */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Select Date Range
          </Typography>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} sm={3}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  label="From Date"
                  value={startDate}
                  onChange={(newValue) => setStartDate(newValue)}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} sm={3}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  label="To Date"
                  value={endDate}
                  onChange={(newValue) => setEndDate(newValue)}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Button
                variant="contained"
                onClick={handleGenerateReport}
                disabled={loading}
                sx={{ height: '56px', minWidth: '120px' }}
              >
                {loading ? <CircularProgress size={24} /> : 'Generate Report'}
              </Button>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleDownload}
                disabled={invoices.length === 0}
              >
                Download CSV
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      {summary && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Total Invoices
                </Typography>
                <Typography variant="h4">
                  {summary.totalInvoices}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Posted Invoices
                </Typography>
                <Typography variant="h4" color="success.main">
                  {summary.postedInvoices}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Draft Invoices
                </Typography>
                <Typography variant="h4" color="warning.main">
                  {summary.draftInvoices}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Total Amount
                </Typography>
                <Typography variant="h4" color="primary.main">
                  {formatCurrency(summary.totalAmount)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Invoices Table */}
      {invoices.length > 0 && (
        <Paper sx={{ width: '100%', overflow: 'hidden' }}>
          <TableContainer sx={{ maxHeight: 600 }}>
            <Table stickyHeader size="small" sx={{ '& .MuiTableCell-root': { padding: '4px 8px', fontSize: '0.75rem' } }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', padding: '4px 8px' }}>S.No</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', padding: '4px 8px' }}>Invoice Number</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', padding: '4px 8px' }}>Company Invoice #</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', padding: '4px 8px' }}>FBR Invoice #</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', padding: '4px 8px' }}>Invoice Date</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', padding: '4px 8px' }}>Status</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', padding: '4px 8px' }}>Buyer Name</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', padding: '4px 8px' }}>Buyer NTN</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', padding: '4px 8px' }}>Seller Name</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', padding: '4px 8px' }}>Product Descriptions</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', padding: '4px 8px' }}>HS Codes</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', padding: '4px 8px' }}>UOM</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', padding: '4px 8px' }}>Qty</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', padding: '4px 8px' }}>Unit Prices</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', padding: '4px 8px' }}>Sales Tax Rate</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', padding: '4px 8px' }}>ST Withheld</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', padding: '4px 8px' }}>Extra Tax</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', padding: '4px 8px' }}>Further Tax</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', padding: '4px 8px' }}>FED Payable</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', padding: '4px 8px' }}>Advance Income Tax</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', padding: '4px 8px' }}>Discount</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', padding: '4px 8px' }}>Subtotal</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', padding: '4px 8px' }}>Tax Amount</TableCell>
                    <TableCell sx={{ fontSize: '0.7rem', fontWeight: 'bold', padding: '4px 8px' }}>Total Amount</TableCell>
                  </TableRow>
                </TableHead>
              <TableBody>
                {invoices.map((invoice, index) => {
                  // Debug logging for first invoice
                  if (index === 0) {
                    console.log('🔍 Processing First Invoice:', invoice);
                    console.log('🔍 Invoice Items:', invoice.items);
                    console.log('🔍 Available Fields:', Object.keys(invoice));
                    console.log('🔍 Invoice Items Length:', invoice.items?.length);
                    if (invoice.items && invoice.items.length > 0) {
                      console.log('🔍 First Item Sample:', invoice.items[0]);
                      console.log('🔍 First Item Fields:', Object.keys(invoice.items[0]));
                    }
                  }

                  const totalAmount = invoice.items?.reduce(
                    (sum, item) => sum + (parseFloat(item.totalValues) || 0),
                    0
                  ) || 0;

                  // Calculate subtotal (before tax)
                  const subtotal = invoice.items?.reduce((sum, item) => {
                    const quantity = parseFloat(item.quantity) || 0;
                    const unitPrice = parseFloat(item.unitPrice) || 0;
                    return sum + (quantity * unitPrice);
                  }, 0) || 0;

                  // Calculate tax amount
                  const taxAmount = invoice.items?.reduce((sum, item) => {
                    const quantity = parseFloat(item.quantity) || 0;
                    const unitPrice = parseFloat(item.unitPrice) || 0;
                    const itemTotal = quantity * unitPrice;
                    const taxRate = parseFloat(item.salesTaxApplicable || item.taxRate) || 0;
                    return sum + (itemTotal * taxRate / 100);
                  }, 0) || 0;

                  // Get unique HS codes
                  const hsCodes = [...new Set(invoice.items?.map(item => item.hsCode).filter(Boolean) || [])];
                  
                  // Get unique UOMs
                  const uoms = [...new Set(invoice.items?.map(item => item.uoM || item.uom || item.unitOfMeasure).filter(Boolean) || [])];

                  // Get product descriptions
                  const productDescriptions = invoice.items?.map(item => item.productDescription).filter(Boolean) || [];

                  // Get quantities
                  const quantities = invoice.items?.map(item => parseFloat(item.quantity || 0).toFixed(2)) || [];

                  // Get unit prices
                  const unitPrices = invoice.items?.map(item => formatCurrency(item.unitPrice)) || [];

                  // Get sales types
                  const salesTypes = [...new Set(invoice.items?.map(item => item.saleType || item.salesType).filter(Boolean) || [])];

                  // Get SRO schedules
                  const sroSchedules = [...new Set(invoice.items?.map(item => item.sroScheduleNo).filter(Boolean) || [])];

                  // Get tax rates
                  const taxRates = [...new Set(invoice.items?.map(item => parseFloat(item.salesTaxApplicable || item.taxRate || 0).toFixed(2)).filter(rate => rate !== '0.00') || [])];

                  // Calculate totals for tax fields
                  const stWithheld = invoice.items?.reduce((sum, item) => sum + (parseFloat(item.stWithheld) || 0), 0) || 0;
                  const extraTax = invoice.items?.reduce((sum, item) => sum + (parseFloat(item.extraTax) || 0), 0) || 0;
                  const furtherTax = invoice.items?.reduce((sum, item) => sum + (parseFloat(item.furtherTax) || 0), 0) || 0;
                  const fedPayable = invoice.items?.reduce((sum, item) => sum + (parseFloat(item.fedPayable) || 0), 0) || 0;
                  const advanceIncomeTax = invoice.items?.reduce((sum, item) => sum + (parseFloat(item.advanceIncomeTax) || 0), 0) || 0;
                  const discount = invoice.items?.reduce((sum, item) => sum + (parseFloat(item.discount) || 0), 0) || 0;

                  return (
                    <TableRow key={invoice.id} hover>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}>
                          {invoice.invoiceNumber || invoice.invoice_number || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                          {invoice.companyInvoiceRefNo || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                          {invoice.fbr_invoice_number || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                          {invoice.invoiceDate ? dayjs(invoice.invoiceDate).format('DD-MM-YYYY') : '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={invoice.status?.toUpperCase() || 'DRAFT'}
                          color={getStatusColor(invoice.status)}
                          size="small"
                          sx={{ fontSize: '0.65rem', height: '20px' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.7rem' }}>
                          {invoice.buyerBusinessName || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                          {invoice.buyerNTNCNIC || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.7rem' }}>
                          {invoice.sellerBusinessName || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.7rem', lineHeight: 1.2 }}>
                          {productDescriptions.length > 0 ? productDescriptions.join(', ') : '-'}
                        </Typography>
                        {index === 0 && (
                          <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.6rem', lineHeight: 1 }}>
                            Debug: {JSON.stringify(productDescriptions)}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.65rem' }}>
                          {hsCodes.length > 0 ? hsCodes.join(', ') : '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                          {uoms.length > 0 ? uoms.join(', ') : '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                          {quantities.length > 0 ? quantities.join(', ') : '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                          {unitPrices.length > 0 ? unitPrices.join(', ') : '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                          {taxRates.length > 0 ? taxRates.join(', ') + '%' : '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'error.main', fontSize: '0.7rem' }}>
                          {formatCurrency(stWithheld)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'error.main', fontSize: '0.7rem' }}>
                          {formatCurrency(extraTax)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'error.main', fontSize: '0.7rem' }}>
                          {formatCurrency(furtherTax)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'error.main', fontSize: '0.7rem' }}>
                          {formatCurrency(fedPayable)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'error.main', fontSize: '0.7rem' }}>
                          {formatCurrency(advanceIncomeTax)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'success.main', fontSize: '0.7rem' }}>
                          {formatCurrency(discount)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}>
                          {formatCurrency(subtotal)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'error.main', fontSize: '0.7rem' }}>
                          {formatCurrency(taxAmount)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'primary.main', fontSize: '0.7rem' }}>
                          {formatCurrency(totalAmount)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* No Data Message */}
      {!loading && invoices.length === 0 && !error && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="textSecondary">
            No invoices found for the selected date range
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            Try selecting a different date range or check if invoices exist for the selected period.
          </Typography>
        </Paper>
      )}

    </Box>
  );
};

export default SalesReport;
