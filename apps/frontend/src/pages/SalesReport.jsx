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
  Autocomplete,
  MenuItem,
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
  const [startDate, setStartDate] = useState(dayjs().startOf('month'));
  const [endDate, setEndDate] = useState(dayjs());
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  
  // Buyer selection state
  const [selectedBuyers, setSelectedBuyers] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [buyerSearch, setBuyerSearch] = useState('');
  const [loadingBuyers, setLoadingBuyers] = useState(false);
  
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(false);
  
  // Status filter state
  const [selectedStatus, setSelectedStatus] = useState('All');
  const statusOptions = [
    { value: 'All', label: 'All Status' },
    { value: 'draft', label: 'Draft' },
    { value: 'saved', label: 'Saved' },
    { value: 'posted', label: 'Posted' },
    { value: 'validated', label: 'Validated' }
  ];

  // Fetch buyers for the dropdown
  const fetchBuyers = async (searchTerm = '') => {
    if (!selectedTenant) return;
    
    setLoadingBuyers(true);
    try {
      const response = await api.get(
        `/tenant/${selectedTenant.tenant_id}/buyers/all`,
        {
          params: {
            search: searchTerm,
          },
        }
      );
      
      if (response.data.success) {
        setBuyers(response.data.data.buyers || []);
      }
    } catch (error) {
      console.error('Error fetching buyers:', error);
      toast.error('Error fetching buyers');
    } finally {
      setLoadingBuyers(false);
    }
  };

  // Fetch products for the dropdown
  const fetchProducts = async (searchTerm = '') => {
    if (!selectedTenant) return;
    
    console.log('🔍 Fetching products with search term:', searchTerm);
    console.log('🔍 Selected tenant:', selectedTenant);
    
    setLoadingProducts(true);
    try {
      const response = await api.get(
        `/tenant/${selectedTenant.tenant_id}/products/all`,
        {
          params: {
            search: searchTerm,
          },
        }
      );
      
      console.log('🔍 Products API response:', response.data);
      
      if (response.data.success) {
        const products = response.data.data.products || [];
        console.log('🔍 Products received:', products.length, 'products');
        setProducts(products);
      } else {
        console.error('🔍 Products API returned success: false');
        toast.error('Failed to fetch products');
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      console.error('Error details:', error.response?.data);
      toast.error('Error fetching products');
    } finally {
      setLoadingProducts(false);
    }
  };

  // Load buyers and products when component mounts or tenant changes
  useEffect(() => {
    if (selectedTenant) {
      fetchBuyers();
      fetchProducts();
    }
  }, [selectedTenant]);

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
      const params = {
            start_date: startDate.format('YYYY-MM-DD'),
            end_date: endDate.format('YYYY-MM-DD'),
            limit: 1000, // Get all invoices in the date range
            include_details: true, // Include complete invoice details
            status: selectedStatus, // Use selected status filter
      };

      // Add buyer filter if selected
      if (selectedBuyers.length > 0) {
        params.buyer_ids = selectedBuyers.map(buyer => buyer.id).join(',');
      }

      // Add product filter if selected
      if (selectedProducts.length > 0) {
        params.product_ids = selectedProducts.map(product => product.id).join(',');
      }

      console.log('🔍 API Request Parameters:', params);
      console.log('🔍 Selected Buyers:', selectedBuyers);
      console.log('🔍 Selected Products:', selectedProducts);
      console.log('🔍 Date Range:', { start: startDate.format('YYYY-MM-DD'), end: endDate.format('YYYY-MM-DD') });

      const response = await api.get(
        `/tenant/${selectedTenant.tenant_id}/invoices`,
        { params }
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


  const handleDownloadCSV = () => {
    // Create CSV data with all comprehensive columns
    const csvData = [
      [
        'S.No', 'Company Invoice #', 'FBR Invoice #', 'Invoice Date', 
        'Buyer Name', 'Buyer NTN', 
        'Product Names', 'HS Codes', 'UOM', 'Qty', 'Unit Prices', 
        'Sales Tax Rate', 'S.T Amount', 'Extra Tax', 'Further Tax', 'FED Payable', 
        'Advance Income Tax', 'Discount', 'Total Value inc.St'
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
          return sum + (parseFloat(item.salesTaxApplicable) || 0);
        }, 0) || 0;

        const hsCodes = [...new Set(invoice.items?.map(item => item.hsCode).filter(Boolean) || [])];
        const uoms = [...new Set(invoice.items?.map(item => item.uoM || item.uom || item.unitOfMeasure).filter(Boolean) || [])];
        const productNames = invoice.items?.map(item => item.name).filter(Boolean) || [];
        const quantities = invoice.items?.map(item => parseFloat(item.quantity || 0).toFixed(2)) || [];
        const unitPrices = invoice.items?.map(item => parseFloat(item.unitPrice || 0).toFixed(2)) || [];
        const salesTypes = [...new Set(invoice.items?.map(item => item.saleType || item.salesType).filter(Boolean) || [])];
        const sroSchedules = [...new Set(invoice.items?.map(item => item.sroScheduleNo).filter(Boolean) || [])];
        // Get sales tax rate from invoice items (the actual rate from API)
        const taxRates = [...new Set(invoice.items?.map(item => {
          // Try rate field first (string like "18"), then salesTaxApplicable (decimal like 18.00)
          const rate = item.rate || item.salesTaxApplicable;
          if (rate) {
            const parsedRate = parseFloat(rate);
            return parsedRate.toFixed(2);
          }
          return null;
        }).filter(rate => rate && rate !== '0.00') || [])];

        const stWithheld = invoice.items?.reduce((sum, item) => sum + (parseFloat(item.stWithheld) || 0), 0) || 0;
        const extraTax = invoice.items?.reduce((sum, item) => sum + (parseFloat(item.extraTax) || 0), 0) || 0;
        const furtherTax = invoice.items?.reduce((sum, item) => sum + (parseFloat(item.furtherTax) || 0), 0) || 0;
        const fedPayable = invoice.items?.reduce((sum, item) => sum + (parseFloat(item.fedPayable) || 0), 0) || 0;
        const advanceIncomeTax = invoice.items?.reduce((sum, item) => sum + (parseFloat(item.advanceIncomeTax) || 0), 0) || 0;
        const discount = invoice.items?.reduce((sum, item) => sum + (parseFloat(item.discount) || 0), 0) || 0;

        return [
          index + 1,
          invoice.companyInvoiceRefNo || '',
          invoice.fbr_invoice_number || '',
          invoice.invoiceDate ? dayjs(invoice.invoiceDate).format('DD-MM-YYYY') : '',
          invoice.buyerBusinessName || '',
          invoice.buyerNTNCNIC || '',
          productNames.join(', '),
          hsCodes.join(', '),
          uoms.join(', '),
          quantities.join(', '),
          unitPrices.join(', '),
          taxRates.join(', ') + (taxRates.length > 0 ? '%' : ''),
          taxAmount.toFixed(2),
          extraTax.toFixed(2),
          furtherTax.toFixed(2),
          fedPayable.toFixed(2),
          advanceIncomeTax.toFixed(2),
          discount.toFixed(2),
          totalAmount.toFixed(2)
        ];
      }),
      // Add Sales Tax Sub-total row
      [
        '', '', '', '', '', '', '', '', '', '', '', 
        'Sales Tax Sub-total:', 
        invoices.reduce((total, invoice) => {
          const taxAmount = invoice.items?.reduce((sum, item) => {
            return sum + (parseFloat(item.salesTaxApplicable) || 0);
          }, 0) || 0;
          return total + taxAmount;
        }, 0).toFixed(2),
        '', '', '', '', '', ''
      ],
      // Add Total Value inc.St Sub-total row
      [
        '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 
        'Total Value inc.St Sub-total:', 
        invoices.reduce((total, invoice) => {
          const totalAmount = invoice.items?.reduce((sum, item) => {
            return sum + (parseFloat(item.totalValues) || 0);
          }, 0) || 0;
          return total + totalAmount;
        }, 0).toFixed(2)
      ]
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

  const handleDownloadPDF = () => {
    // Create a simple PDF using browser's print functionality
    const printWindow = window.open('', '_blank');
    
    // Get the table element
    const tableElement = document.querySelector('.invoice-table');
    
    if (!tableElement) {
      toast.error('No data to export');
      return;
    }

    // Create HTML content for PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Sales Report - ${startDate.format('DD/MM/YYYY')} to ${endDate.format('DD/MM/YYYY')}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              color: #333;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #1976d2;
              padding-bottom: 20px;
            }
            .company-info {
              margin-bottom: 20px;
            }
            .filter-info {
              background-color: #f5f5f5;
              padding: 15px;
              border-radius: 5px;
              margin-bottom: 20px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
              font-size: 12px;
              border: 1px solid #333;
            }
            th, td {
              border: 1px solid #333;
              padding: 8px;
              text-align: left;
            }
            th {
              background-color: #f2f2f2;
              font-weight: bold;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            tr:nth-child(odd) {
              background-color: #ffffff;
            }
            .s-t-amount {
              color: #d32f2f;
              font-weight: bold;
            }
            .extra-tax, .further-tax, .fed-payable, .advance-income-tax, .discount {
              color: #2e7d32;
            }
            .total-value {
              color: #1976d2;
              font-weight: bold;
            }
            .summary {
              margin-top: 30px;
              padding: 20px;
              background-color: #f9f9f9;
              border-radius: 5px;
            }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Sales Tax Summary</h1>
            <h2>For the Period ${startDate.format('DD/MM/YYYY')} to ${endDate.format('DD/MM/YYYY')}</h2>
          </div>
          
          <div class="company-info">
            <h3>Company: ${selectedTenant?.sellerBusinessName || selectedTenant?.company_name || 'N/A'}</h3>
            <p><strong>NTN:</strong> ${selectedTenant?.sellerFullNTN || selectedTenant?.ntn || 'N/A'}</p>
          </div>
          
          <div class="filter-info">
           
            <p><strong>Date Range:</strong> ${startDate.format('DD/MM/YYYY')} to ${endDate.format('DD/MM/YYYY')}</p>
            ${selectedBuyers.length > 0 ? `<p><strong>Buyers:</strong> ${selectedBuyers.map(b => b.businessName).join(', ')}</p>` : ''}
            ${selectedProducts.length > 0 ? `<p><strong>Products:</strong> ${selectedProducts.map(p => p.name).join(', ')}</p>` : ''}
          </div>
          
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Company Invoice #</th>
                  <th>FBR Invoice #</th>
                  <th>Invoice Date</th>
                  <th>Buyer Name</th>
                  <th>Buyer NTN</th>
                  <th>Product Names</th>
                  <th>HS Codes</th>
                  <th>UOM</th>
                  <th>Qty</th>
                  <th>Unit Prices</th>
                  <th>Sales Tax Rate</th>
                  <th>S.T Amount</th>
                  <th>Extra Tax</th>
                  <th>Further Tax</th>
                  <th>FED Payable</th>
                  <th>Advance Income Tax</th>
                  <th>Discount</th>
                  <th>Total Value inc.St</th>
                </tr>
              </thead>
              <tbody>
                ${invoices.map((invoice, index) => {
                  const totalAmount = invoice.items?.reduce((sum, item) => {
                    const quantity = parseFloat(item.quantity) || 0;
                    const unitPrice = parseFloat(item.unitPrice) || 0;
                    const itemTotal = quantity * unitPrice;
                    return sum + itemTotal;
                  }, 0) || 0;

                  const taxAmount = invoice.items?.reduce((sum, item) => {
                    return sum + (parseFloat(item.salesTaxApplicable) || 0);
                  }, 0) || 0;

                  const extraTax = invoice.items?.reduce((sum, item) => parseFloat(item.extraTax) || 0, 0) || 0;
                  const furtherTax = invoice.items?.reduce((sum, item) => parseFloat(item.furtherTax) || 0, 0) || 0;
                  const fedPayable = invoice.items?.reduce((sum, item) => parseFloat(item.fedPayable) || 0, 0) || 0;
                  const advanceIncomeTax = invoice.items?.reduce((sum, item) => parseFloat(item.advanceIncomeTax) || 0, 0) || 0;
                  const discount = invoice.items?.reduce((sum, item) => parseFloat(item.discount) || 0, 0) || 0;

                  const productNames = invoice.items?.map(item => item.name).filter(Boolean) || [];
                  const hsCodes = [...new Set(invoice.items?.map(item => item.hsCode).filter(Boolean) || [])];
                  const uoms = [...new Set(invoice.items?.map(item => item.uoM || item.uom || item.unitOfMeasure).filter(Boolean) || [])];
                  const quantities = invoice.items?.map(item => parseFloat(item.quantity || 0).toFixed(2)) || [];
                  const unitPrices = invoice.items?.map(item => parseFloat(item.unitPrice || 0).toFixed(2)) || [];

                  const taxRates = [...new Set(invoice.items?.map(item => {
                    const rate = item.rate || item.salesTaxApplicable;
                    if (rate) {
                      const parsedRate = parseFloat(rate);
                      return parsedRate.toFixed(2);
                    }
                    return null;
                  }).filter(rate => rate && rate !== '0.00') || [])];

                  return `
                    <tr>
                      <td>${index + 1}</td>
                      <td>${invoice.companyInvoiceRefNo || '-'}</td>
                      <td>${invoice.fbr_invoice_number || '-'}</td>
                      <td>${invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString('en-GB') : '-'}</td>
                      <td>${invoice.buyerBusinessName || '-'}</td>
                      <td>${invoice.buyerNTNCNIC || '-'}</td>
                      <td>${productNames.join(', ')}</td>
                      <td>${hsCodes.join(', ')}</td>
                      <td>${uoms.join(', ')}</td>
                      <td>${quantities.join(', ')}</td>
                      <td>Rs ${unitPrices.map(price => parseFloat(price).toLocaleString()).join(', ')}</td>
                      <td>${taxRates.join(', ')}${taxRates.length > 0 ? '%' : ''}</td>
                      <td class="s-t-amount">Rs ${taxAmount.toFixed(2)}</td>
                      <td class="extra-tax">Rs ${extraTax.toFixed(2)}</td>
                      <td class="further-tax">Rs ${furtherTax.toFixed(2)}</td>
                      <td class="fed-payable">Rs ${fedPayable.toFixed(2)}</td>
                      <td class="advance-income-tax">Rs ${advanceIncomeTax.toFixed(2)}</td>
                      <td class="discount">Rs ${discount.toFixed(2)}</td>
                      <td class="total-value">Rs ${totalAmount.toFixed(2)}</td>
                    </tr>
                  `;
                }).join('')}
                
                <!-- Sales Tax Sub-total Row -->
                <tr style="background-color: #f8f9fa; border-top: 2px solid #dee2e6; font-weight: bold;">
                  <td colspan="12" style="text-align: right; padding: 12px 16px; color: #495057; border-bottom: 1px solid #dee2e6;">
                    Sales Tax Sub-total:
                  </td>
                  <td style="color: #dc3545; font-weight: bold; padding: 12px 16px; border-bottom: 1px solid #dee2e6;">
                    Rs ${invoices.reduce((total, invoice) => {
                      const taxAmount = invoice.items?.reduce((sum, item) => {
                        return sum + (parseFloat(item.salesTaxApplicable) || 0);
                      }, 0) || 0;
                      return total + taxAmount;
                    }, 0).toFixed(2)}
                  </td>
                  <td colspan="6" style="padding: 12px 16px; border-bottom: 1px solid #dee2e6;"></td>
                </tr>
                
                <!-- Total Value inc.St Sub-total Row -->
                <tr style="background-color: #e8f4fd; font-weight: bold;">
                  <td colspan="18" style="text-align: right; padding: 12px 16px; color: #495057; border-bottom: 2px solid #dee2e6;">
                    Total Value inc.St Sub-total:
                  </td>
                  <td style="color: #1976d2; font-weight: bold; padding: 12px 16px; border-bottom: 2px solid #dee2e6;">
                    Rs ${invoices.reduce((total, invoice) => {
                      const totalAmount = invoice.items?.reduce((sum, item) => {
                        return sum + (parseFloat(item.totalValues) || 0);
                      }, 0) || 0;
                      return total + totalAmount;
                    }, 0).toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div class="summary">
            <h4>Summary</h4>
            <p><strong>Total Invoices:</strong> ${invoices.length}</p>
            <p><strong>Sales Tax Sub-total:</strong> Rs ${invoices.reduce((total, invoice) => {
              const taxAmount = invoice.items?.reduce((sum, item) => {
                return sum + (parseFloat(item.salesTaxApplicable) || 0);
              }, 0) || 0;
              return total + taxAmount;
            }, 0).toFixed(2)}</p>
            <p><strong>Total Value inc.St Sub-total:</strong> Rs ${invoices.reduce((total, invoice) => {
              const totalAmount = invoice.items?.reduce((sum, item) => {
                return sum + (parseFloat(item.totalValues) || 0);
              }, 0) || 0;
              return total + totalAmount;
            }, 0).toFixed(2)}</p>
            <p><strong>Generated on:</strong> ${new Date().toLocaleString()}</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Wait for content to load, then trigger print
    printWindow.onload = () => {
      printWindow.print();
    };
    
    toast.success('PDF download initiated');
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
    <Box sx={{ p: 3, backgroundColor: '#ffffff', minHeight: '100vh' }}>
      {/* Company Header */}
      <Card 
        sx={{ 
          mb: 4, 
          borderRadius: 2,
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          border: '1px solid #e0e0e0',
          backgroundColor: '#f8f9fa'
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography 
              variant="h5" 
              sx={{ 
                fontWeight: 'bold', 
                color: '#333333',
                mb: 1
              }}
            >
              {selectedTenant?.sellerBusinessName || selectedTenant?.name || 'Company Name'}
      </Typography>
            <Typography 
              variant="h6" 
              sx={{ 
                color: '#666666',
                mb: 2
              }}
            >
              NTN: {selectedTenant?.sellerNTNCNIC || selectedTenant?.ntn || 'N/A'}
            </Typography>
            <Typography 
              variant="h4" 
              sx={{ 
                fontWeight: 'bold', 
                color: '#333333',
                mb: 0
              }}
            >
              Sales Tax Summary for the Period {startDate.format('DD/MM/YYYY')} to {endDate.format('DD/MM/YYYY')}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Filter Section */}
      <Card 
        sx={{ 
          mb: 4, 
          borderRadius: 2,
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          border: '1px solid #e0e0e0'
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Typography 
            variant="h6" 
            sx={{ 
              mb: 3, 
              color: '#333333',
              fontWeight: '600'
            }}
          >
            Filter Options
          </Typography>
          
          <Box sx={{ 
            display: 'flex', 
            gap: { xs: 1, sm: 2, md: 3 }, 
            alignItems: 'end', 
            flexWrap: 'wrap',
            flexDirection: { xs: 'column', sm: 'row' }
          }}>
            {/* Date Fields Row */}
            <Box sx={{ 
              display: 'flex', 
              gap: { xs: 1, sm: 2 }, 
              width: { xs: '100%', sm: 'auto' },
              flexDirection: { xs: 'column', sm: 'row' }
            }}>
              {/* From Date */}
              <Box sx={{ 
                minWidth: { xs: '100%', sm: '140px', md: '160px' }, 
                flex: { xs: '1', sm: '0 0 140px', md: '0 0 160px' }
              }}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  label="From Date"
                  value={startDate}
                  onChange={(newValue) => setStartDate(newValue)}
                    renderInput={(params) => (
                      <TextField 
                        {...params} 
                        fullWidth 
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 1,
                            backgroundColor: '#ffffff',
                            '&:hover .MuiOutlinedInput-notchedOutline': {
                              borderColor: '#1976d2',
                            },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                              borderColor: '#1976d2',
                              borderWidth: 2,
                            },
                          },
                        }}
                      />
                    )}
                />
              </LocalizationProvider>
              </Box>
              
              {/* To Date */}
              <Box sx={{ 
                minWidth: { xs: '100%', sm: '140px', md: '160px' }, 
                flex: { xs: '1', sm: '0 0 140px', md: '0 0 160px' }
              }}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  label="To Date"
                  value={endDate}
                  onChange={(newValue) => setEndDate(newValue)}
                    renderInput={(params) => (
                      <TextField 
                        {...params} 
                        fullWidth 
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 1,
                            backgroundColor: '#ffffff',
                            '&:hover .MuiOutlinedInput-notchedOutline': {
                              borderColor: '#1976d2',
                            },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                              borderColor: '#1976d2',
                              borderWidth: 2,
                            },
                          },
                        }}
                      />
                    )}
                />
              </LocalizationProvider>
              </Box>
            </Box>
            
            {/* Select Buyers - Multiple selection */}
            <Box sx={{ 
              flex: { xs: '1', sm: '0 0 200px', md: '0 0 250px' }, 
              minWidth: { xs: '100%', sm: '180px', md: '200px' },
              width: { xs: '100%', sm: 'auto' }
            }}>
              <Autocomplete
                fullWidth
                multiple
                options={buyers}
                getOptionLabel={(option) =>
                  option.buyerBusinessName
                    ? `${option.buyerBusinessName} (${option.buyerNTNCNIC})`
                    : ""
                }
                value={selectedBuyers}
                onChange={(_, newValue) => setSelectedBuyers(newValue)}
                onInputChange={(_, inputValue) => {
                  setBuyerSearch(inputValue);
                  // Debounce search
                  const timeoutId = setTimeout(() => {
                    fetchBuyers(inputValue);
                  }, 300);
                  return () => clearTimeout(timeoutId);
                }}
                loading={loadingBuyers}
                disableCloseOnSelect={true}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Select Buyers (Optional)"
                    variant="outlined"
                    placeholder="Search buyers by name or NTN/CNIC..."
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 1,
                        backgroundColor: '#ffffff',
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#1976d2',
                        },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#1976d2',
                          borderWidth: 2,
                        },
                        '& .MuiChip-root': {
                          display: 'none !important',
                        },
                      },
                    }}
                  />
                )}
                isOptionEqualToValue={(option, value) => option.id === value?.id}
                renderOption={(props, option) => (
                  <Box component="li" {...props} sx={{ py: 1.5 }}>
                    <Box>
                      <Typography variant="body1" fontWeight="500">
                        {option.buyerBusinessName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {option.buyerNTNCNIC}
                      </Typography>
                    </Box>
                  </Box>
                )}
                getOptionKey={(option) => option.id}
                noOptionsText="No buyers found"
                clearOnEscape
                selectOnFocus
                handleHomeEndKeys
                ListboxProps={{
                  style: {
                    maxHeight: '300px',
                    zIndex: 9999
                  }
                }}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      {...getTagProps({ index })}
                      key={option.id}
                      label={`${option.buyerBusinessName} (${option.buyerNTNCNIC})`}
                      size="small"
                      sx={{
                        backgroundColor: '#e9ecef',
                        color: '#495057',
                        '& .MuiChip-deleteIcon': {
                          color: '#6c757d',
                        },
                      }}
                    />
                  ))
                }
              />
            </Box>
            
            {/* Select Products - Multiple selection */}
                <Box sx={{ 
                  flex: { xs: '1', sm: '0 0 200px', md: '0 0 250px' }, 
                  minWidth: { xs: '100%', sm: '180px', md: '200px' },
                  width: { xs: '100%', sm: 'auto' }
                }}>
                  <Autocomplete
                    fullWidth
                    multiple
                    options={products}
                    getOptionLabel={(option) =>
                      option.name
                        ? `${option.name} (${option.hsCode || 'No HS Code'})`
                        : ""
                    }
                    value={selectedProducts}
                    onChange={(_, newValue) => setSelectedProducts(newValue)}
                    onInputChange={(_, inputValue) => {
                      setProductSearch(inputValue);
                      const timeoutId = setTimeout(() => {
                        fetchProducts(inputValue);
                      }, 300);
                      return () => clearTimeout(timeoutId);
                    }}
                    loading={loadingProducts}
                    disableCloseOnSelect={true}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Select Products (Optional)"
                        variant="outlined"
                        placeholder="Search products by name or HS code..."
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 1,
                            backgroundColor: '#ffffff',
                            '&:hover .MuiOutlinedInput-notchedOutline': {
                              borderColor: '#1976d2',
                            },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                              borderColor: '#1976d2',
                              borderWidth: 2,
                            },
                            '& .MuiChip-root': {
                              display: 'none !important',
                            },
                          },
                        }}
                      />
                    )}
                    isOptionEqualToValue={(option, value) => option.id === value?.id}
                    renderOption={(props, option) => (
                      <Box component="li" {...props} sx={{ py: 1.5 }}>
                        <Box>
                          <Typography variant="body1" fontWeight="500">
                            {option.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            HS Code: {option.hsCode || 'Not specified'}
                          </Typography>
                        </Box>
                      </Box>
                    )}
                    getOptionKey={(option) => option.id}
                    noOptionsText="No products found"
                    clearOnEscape
                    selectOnFocus
                    handleHomeEndKeys
                    ListboxProps={{
                      style: {
                        maxHeight: '300px',
                        zIndex: 9999
                      }
                    }}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip
                          {...getTagProps({ index })}
                          key={option.id}
                          label={`${option.name} (${option.hsCode || 'No HS Code'})`}
                          size="small"
                          sx={{
                            backgroundColor: '#e9ecef',
                            color: '#495057',
                            '& .MuiChip-deleteIcon': {
                              color: '#6c757d',
                            },
                          }}
                        />
                      ))
                    }
                  />
                </Box>
            
            {/* Select Status - Single selection */}
            <Box sx={{ 
              flex: { xs: '1', sm: '0 0 150px', md: '0 0 180px' }, 
              minWidth: { xs: '100%', sm: '120px', md: '150px' },
              width: { xs: '100%', sm: 'auto' }
            }}>
              <TextField
                select
                fullWidth
                label="Select Status"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                variant="outlined"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 1,
                    backgroundColor: '#ffffff',
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#1976d2',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#1976d2',
                      borderWidth: 2,
                    },
                  },
                }}
              >
                {statusOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
            
            {/* Buttons Row */}
            <Box sx={{ 
              display: 'flex', 
              gap: { xs: 1, sm: 2 }, 
              width: { xs: '100%', sm: 'auto' },
              flexDirection: { xs: 'row', sm: 'row' }
            }}>
              {/* Generate Button */}
              <Box sx={{ 
                minWidth: { xs: '50%', sm: '100px', md: '120px' }, 
                flex: { xs: '1', sm: '0 0 100px', md: '0 0 120px' }
              }}>
              <Button
                variant="contained"
                onClick={handleGenerateReport}
                disabled={loading}
                  sx={{ 
                    height: '56px', 
                    minWidth: '100%',
                    borderRadius: 1,
                    backgroundColor: '#1976d2',
                    '&:hover': {
                      backgroundColor: '#1565c0',
                    },
                    '&:disabled': {
                      backgroundColor: '#bdbdbd',
                    }
                  }}
                >
                  {loading ? <CircularProgress size={24} color="inherit" /> : 'Generate'}
              </Button>
              </Box>
              
              {/* Download Buttons */}
              <Box sx={{ 
                minWidth: { xs: '50%', sm: '200px', md: '240px' }, 
                flex: { xs: '1', sm: '0 0 200px', md: '0 0 240px' },
                display: 'flex',
                gap: 1
              }}>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={handleDownloadCSV}
                  disabled={invoices.length === 0}
                  sx={{ 
                    height: '56px',
                    flex: 1,
                    borderRadius: 1,
                    borderColor: '#4caf50',
                    color: '#4caf50',
                    '&:hover': {
                      borderColor: '#388e3c',
                      backgroundColor: 'rgba(76, 175, 80, 0.04)',
                      borderWidth: 2,
                    },
                    '&:disabled': {
                      borderColor: '#bdbdbd',
                      color: '#bdbdbd',
                    }
                  }}
                >
                  CSV
                </Button>

                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={handleDownloadPDF}
                  disabled={invoices.length === 0}
                  sx={{ 
                    height: '56px',
                    flex: 1,
                    borderRadius: 1,
                    borderColor: '#f44336',
                    color: '#f44336',
                    '&:hover': {
                      borderColor: '#d32f2f',
                      backgroundColor: 'rgba(244, 67, 54, 0.04)',
                      borderWidth: 2,
                    },
                    '&:disabled': {
                      borderColor: '#bdbdbd',
                      color: '#bdbdbd',
                    }
                  }}
                >
                  PDF
                </Button>
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert 
          severity="error" 
          sx={{ 
            mb: 3,
            borderRadius: 2,
            '& .MuiAlert-message': {
              fontSize: '0.9rem'
            }
          }}
        >
          {error}
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <Card 
          sx={{ 
            p: 6, 
            textAlign: 'center',
            borderRadius: 2,
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            border: '1px solid #e0e0e0',
            mb: 4
          }}
        >
          <CircularProgress size={60} sx={{ mb: 3, color: '#1976d2' }} />
          <Typography variant="h6" sx={{ color: '#333333', fontWeight: '500' }}>
            Generating Report...
                </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Please wait while we fetch and process your invoice data
                </Typography>
            </Card>
      )}

      {/* Selected Buyers Info */}
      {selectedBuyers.length > 0 && (
        <Card
          sx={{
            mb: 4,
            backgroundColor: '#f8f9fa',
            border: '1px solid #e0e0e0',
            borderRadius: 2,
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              <Box sx={{
                p: 1.5,
                borderRadius: 1,
                backgroundColor: '#6c757d',
                color: 'white',
                mt: 0.5
              }}>
                👥
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" sx={{ color: '#495057', fontWeight: '600', mb: 1 }}>
                  Filtered by {selectedBuyers.length === 1 ? 'Buyer' : 'Buyers'} ({selectedBuyers.length})
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {selectedBuyers.map((buyer, index) => (
                    <Chip
                      key={buyer.id}
                      label={`${buyer.buyerBusinessName} (${buyer.buyerNTNCNIC})`}
                      size="small"
                      sx={{
                        backgroundColor: '#e9ecef',
                        color: '#495057',
                        border: '1px solid #dee2e6',
                        '& .MuiChip-deleteIcon': {
                          color: '#6c757d',
                        },
                      }}
                      onDelete={() => {
                        const newBuyers = selectedBuyers.filter((_, i) => i !== index);
                        setSelectedBuyers(newBuyers);
                      }}
                    />
                  ))}
                </Box>
              </Box>
            </Box>
              </CardContent>
            </Card>
      )}

      {/* Selected Products Info */}
      {selectedProducts.length > 0 && (
        <Card
          sx={{
            mb: 4,
            backgroundColor: '#f8f9fa',
            border: '1px solid #e0e0e0',
            borderRadius: 2,
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              <Box sx={{
                p: 1.5,
                borderRadius: 1,
                backgroundColor: '#6c757d',
                color: 'white',
                mt: 0.5
              }}>
                📦
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" sx={{ color: '#495057', fontWeight: '600', mb: 1 }}>
                  Filtered by {selectedProducts.length === 1 ? 'Product' : 'Products'} ({selectedProducts.length})
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {selectedProducts.map((product, index) => (
                    <Chip
                      key={product.id}
                      label={`${product.name} (${product.hsCode || 'No HS Code'})`}
                      size="small"
                      sx={{
                        backgroundColor: '#e9ecef',
                        color: '#495057',
                        border: '1px solid #dee2e6',
                        '& .MuiChip-deleteIcon': {
                          color: '#6c757d',
                        },
                      }}
                      onDelete={() => {
                        const newProducts = selectedProducts.filter((_, i) => i !== index);
                        setSelectedProducts(newProducts);
                      }}
                    />
                  ))}
                </Box>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Status Filter Display */}
      {selectedStatus && selectedStatus !== 'All' && (
        <Card
          sx={{
            mb: 4,
            backgroundColor: '#f8f9fa',
            border: '1px solid #e0e0e0',
            borderRadius: 2,
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              <Box sx={{
                p: 1.5,
                borderRadius: 1,
                backgroundColor: '#6c757d',
                color: 'white',
                mt: 0.5
              }}>
                📋
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" sx={{ color: '#495057', fontWeight: '600', mb: 1 }}>
                  Filtered by Status
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  <Chip
                    label={statusOptions.find(opt => opt.value === selectedStatus)?.label || selectedStatus}
                    size="small"
                    sx={{
                      backgroundColor: '#e9ecef',
                      color: '#495057',
                      border: '1px solid #dee2e6',
                      '& .MuiChip-deleteIcon': {
                        color: '#6c757d',
                      },
                    }}
                    onDelete={() => setSelectedStatus('All')}
                  />
                </Box>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Invoices Table */}
      {invoices.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography 
            variant="h5" 
            sx={{ 
              mb: 3, 
              color: '#333333',
              fontWeight: '600'
            }}
          >
            Invoice Details
          </Typography>
          <Paper 
            sx={{ 
              width: '100%', 
              overflow: 'hidden',
              borderRadius: 2,
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              border: '1px solid #e0e0e0'
            }}
          >
          <TableContainer sx={{ maxHeight: 600 }}>
              <Table stickyHeader size="small" className="invoice-table">
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                    <TableCell sx={{ 
                      fontSize: '0.8rem', 
                      fontWeight: 'bold', 
                      padding: '12px 16px',
                      color: '#333333',
                      borderBottom: '2px solid #e0e0e0'
                    }}>
                      S.No
                    </TableCell>
                    <TableCell sx={{ 
                      fontSize: '0.8rem', 
                      fontWeight: 'bold', 
                      padding: '12px 16px',
                      color: '#333333',
                      borderBottom: '2px solid #e0e0e0'
                    }}>
                      Company Invoice #
                    </TableCell>
                    <TableCell sx={{ 
                      fontSize: '0.8rem', 
                      fontWeight: 'bold', 
                      padding: '12px 16px',
                      color: '#333333',
                      borderBottom: '2px solid #e0e0e0'
                    }}>
                      FBR Invoice #
                    </TableCell>
                    <TableCell sx={{ 
                      fontSize: '0.8rem', 
                      fontWeight: 'bold', 
                      padding: '12px 16px',
                      color: '#333333',
                      borderBottom: '2px solid #e0e0e0'
                    }}>
                      Invoice Date
                    </TableCell>
                    <TableCell sx={{ 
                      fontSize: '0.8rem', 
                      fontWeight: 'bold', 
                      padding: '12px 16px',
                      color: '#333333',
                      borderBottom: '2px solid #e0e0e0'
                    }}>
                      Buyer Name
                    </TableCell>
                    <TableCell sx={{ 
                      fontSize: '0.8rem', 
                      fontWeight: 'bold', 
                      padding: '12px 16px',
                      color: '#333333',
                      borderBottom: '2px solid #e0e0e0'
                    }}>
                      Buyer NTN
                    </TableCell>
                    <TableCell sx={{ 
                      fontSize: '0.8rem', 
                      fontWeight: 'bold', 
                      padding: '12px 16px',
                      color: '#333333',
                      borderBottom: '2px solid #e0e0e0'
                    }}>
                      Product Names
                    </TableCell>
                    <TableCell sx={{ 
                      fontSize: '0.8rem', 
                      fontWeight: 'bold', 
                      padding: '12px 16px',
                      color: '#333333',
                      borderBottom: '2px solid #e0e0e0'
                    }}>
                      HS Codes
                    </TableCell>
                    <TableCell sx={{ 
                      fontSize: '0.8rem', 
                      fontWeight: 'bold', 
                      padding: '12px 16px',
                      color: '#333333',
                      borderBottom: '2px solid #e0e0e0'
                    }}>
                      UOM
                    </TableCell>
                    <TableCell sx={{ 
                      fontSize: '0.8rem', 
                      fontWeight: 'bold', 
                      padding: '12px 16px',
                      color: '#333333',
                      borderBottom: '2px solid #e0e0e0'
                    }}>
                      Qty
                    </TableCell>
                    <TableCell sx={{ 
                      fontSize: '0.8rem', 
                      fontWeight: 'bold', 
                      padding: '12px 16px',
                      color: '#333333',
                      borderBottom: '2px solid #e0e0e0'
                    }}>
                      Unit Prices
                    </TableCell>
                    <TableCell sx={{ 
                      fontSize: '0.8rem', 
                      fontWeight: 'bold', 
                      padding: '12px 16px',
                      color: '#333333',
                      borderBottom: '2px solid #e0e0e0'
                    }}>
                      Sales Tax Rate
                    </TableCell>
                    <TableCell sx={{ 
                      fontSize: '0.8rem', 
                      fontWeight: 'bold', 
                      padding: '12px 16px',
                      color: '#333333',
                      borderBottom: '2px solid #e0e0e0'
                    }}>
                      S.T Amount
                    </TableCell>
                    <TableCell sx={{ 
                      fontSize: '0.8rem', 
                      fontWeight: 'bold', 
                      padding: '12px 16px',
                      color: '#333333',
                      borderBottom: '2px solid #e0e0e0'
                    }}>
                      Extra Tax
                    </TableCell>
                    <TableCell sx={{ 
                      fontSize: '0.8rem', 
                      fontWeight: 'bold', 
                      padding: '12px 16px',
                      color: '#333333',
                      borderBottom: '2px solid #e0e0e0'
                    }}>
                      Further Tax
                    </TableCell>
                    <TableCell sx={{ 
                      fontSize: '0.8rem', 
                      fontWeight: 'bold', 
                      padding: '12px 16px',
                      color: '#333333',
                      borderBottom: '2px solid #e0e0e0'
                    }}>
                      FED Payable
                    </TableCell>
                    <TableCell sx={{ 
                      fontSize: '0.8rem', 
                      fontWeight: 'bold', 
                      padding: '12px 16px',
                      color: '#333333',
                      borderBottom: '2px solid #e0e0e0'
                    }}>
                      Advance Income Tax
                    </TableCell>
                    <TableCell sx={{ 
                      fontSize: '0.8rem', 
                      fontWeight: 'bold', 
                      padding: '12px 16px',
                      color: '#333333',
                      borderBottom: '2px solid #e0e0e0'
                    }}>
                      Discount
                    </TableCell>
                    <TableCell sx={{ 
                      fontSize: '0.8rem', 
                      fontWeight: 'bold', 
                      padding: '12px 16px',
                      color: '#333333',
                      borderBottom: '2px solid #e0e0e0'
                    }}>
                      Total Value inc.St
                    </TableCell>
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
                      console.log('🔍 Rate field value:', invoice.items[0].rate);
                      console.log('🔍 salesTaxApplicable field value:', invoice.items[0].salesTaxApplicable);
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

                  // Calculate tax amount using pre-calculated salesTaxApplicable field
                  const taxAmount = invoice.items?.reduce((sum, item) => {
                    return sum + (parseFloat(item.salesTaxApplicable) || 0);
                  }, 0) || 0;

                  // Get unique HS codes
                  const hsCodes = [...new Set(invoice.items?.map(item => item.hsCode).filter(Boolean) || [])];
                  
                  // Get unique UOMs
                  const uoms = [...new Set(invoice.items?.map(item => item.uoM || item.uom || item.unitOfMeasure).filter(Boolean) || [])];

                  // Get product descriptions
                  const productNames = invoice.items?.map(item => item.name).filter(Boolean) || [];

                  // Get quantities
                  const quantities = invoice.items?.map(item => parseFloat(item.quantity || 0).toFixed(2)) || [];

                  // Get unit prices
                  const unitPrices = invoice.items?.map(item => formatCurrency(item.unitPrice)) || [];

                  // Get sales types
                  const salesTypes = [...new Set(invoice.items?.map(item => item.saleType || item.salesType).filter(Boolean) || [])];

                  // Get SRO schedules
                  const sroSchedules = [...new Set(invoice.items?.map(item => item.sroScheduleNo).filter(Boolean) || [])];

                  // Get tax rates
                  // Get sales tax rate from invoice items (the actual rate from API)
        const taxRates = [...new Set(invoice.items?.map(item => {
          // Try rate field first (string like "18"), then salesTaxApplicable (decimal like 18.00)
          const rate = item.rate || item.salesTaxApplicable;
          if (rate) {
            const parsedRate = parseFloat(rate);
            return parsedRate.toFixed(2);
          }
          return null;
        }).filter(rate => rate && rate !== '0.00') || [])];

                  // Calculate totals for tax fields
                  const stWithheld = invoice.items?.reduce((sum, item) => sum + (parseFloat(item.stWithheld) || 0), 0) || 0;
                  const extraTax = invoice.items?.reduce((sum, item) => sum + (parseFloat(item.extraTax) || 0), 0) || 0;
                  const furtherTax = invoice.items?.reduce((sum, item) => sum + (parseFloat(item.furtherTax) || 0), 0) || 0;
                  const fedPayable = invoice.items?.reduce((sum, item) => sum + (parseFloat(item.fedPayable) || 0), 0) || 0;
                  const advanceIncomeTax = invoice.items?.reduce((sum, item) => sum + (parseFloat(item.advanceIncomeTax) || 0), 0) || 0;
                  const discount = invoice.items?.reduce((sum, item) => sum + (parseFloat(item.discount) || 0), 0) || 0;

                  return (
                    <TableRow 
                      key={invoice.id} 
                      hover
                      sx={{ 
                        '&:nth-of-type(odd)': { 
                          backgroundColor: '#fafafa' 
                        },
                        '&:hover': { 
                          backgroundColor: '#f5f5f5' 
                        },
                        '& .MuiTableCell-root': {
                          padding: '8px 16px',
                          fontSize: '0.75rem',
                          borderBottom: '1px solid #e0e0e0'
                        }
                      }}
                    >
                      <TableCell>{index + 1}</TableCell>
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
                        <Typography variant="caption" sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.7rem', lineHeight: 1.2 }}>
                          {productNames.length > 0 ? productNames.join(', ') : '-'}
                        </Typography>
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
                          {formatCurrency(taxAmount)}
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
                        <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'primary.main', fontSize: '0.7rem' }}>
                          {formatCurrency(totalAmount)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
                
                {/* Sales Tax Sub-total Row */}
                {invoices.length > 0 && (
                  <TableRow sx={{ 
                    backgroundColor: '#f8f9fa',
                    borderTop: '2px solid #dee2e6',
                    '& .MuiTableCell-root': {
                      padding: '12px 16px',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      borderBottom: '1px solid #dee2e6'
                    }
                  }}>
                    <TableCell colSpan={12} sx={{ textAlign: 'right', color: '#495057' }}>
                      Sales Tax Sub-total:
                    </TableCell>
                    <TableCell sx={{ 
                      color: 'error.main',
                      fontSize: '0.8rem',
                      fontWeight: 'bold'
                    }}>
                      {formatCurrency(
                        invoices.reduce((total, invoice) => {
                          const taxAmount = invoice.items?.reduce((sum, item) => {
                            return sum + (parseFloat(item.salesTaxApplicable) || 0);
                          }, 0) || 0;
                          return total + taxAmount;
                        }, 0)
                      )}
                    </TableCell>
                    <TableCell colSpan={6}></TableCell>
                  </TableRow>
                )}
                
                {/* Total Value inc.St Sub-total Row */}
                {invoices.length > 0 && (
                  <TableRow sx={{ 
                    backgroundColor: '#e8f4fd',
                    '& .MuiTableCell-root': {
                      padding: '12px 16px',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      borderBottom: '2px solid #dee2e6'
                    }
                  }}>
                    <TableCell colSpan={18} sx={{ textAlign: 'right', color: '#495057' }}>
                      Total Value inc.St Sub-total:
                    </TableCell>
                    <TableCell sx={{ 
                      color: 'primary.main',
                      fontSize: '0.8rem',
                      fontWeight: 'bold'
                    }}>
                      {formatCurrency(
                        invoices.reduce((total, invoice) => {
                          const totalAmount = invoice.items?.reduce((sum, item) => {
                            return sum + (parseFloat(item.totalValues) || 0);
                          }, 0) || 0;
                          return total + totalAmount;
                        }, 0)
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
        </Box>
      )}

      {/* No Data Message */}
      {!loading && invoices.length === 0 && !error && (
        <Card 
          sx={{ 
            p: 6, 
            textAlign: 'center',
            borderRadius: 2,
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            border: '1px solid #e0e0e0',
            backgroundColor: '#fafafa'
          }}
        >
          <Box sx={{ mb: 3 }}>
            <Typography variant="h1" sx={{ fontSize: '4rem', mb: 2 }}>
              📊
          </Typography>
            <Typography variant="h5" sx={{ color: '#666666', fontWeight: '600', mb: 2 }}>
              No invoices found
          </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '400px', mx: 'auto' }}>
              No invoices were found for the selected date range and buyer filter. 
              Try adjusting your filters or check if invoices exist for the selected period.
            </Typography>
          </Box>
        </Card>
      )}

    </Box>
  );
};

export default SalesReport;
