import React, { useEffect, useState, useCallback } from "react";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  useTheme,
  Skeleton,
  TextField,
  MenuItem,
  InputAdornment,
} from "@mui/material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import VisibilityIcon from "@mui/icons-material/Visibility";
import PrintIcon from "@mui/icons-material/Print";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";

import { api, API_CONFIG } from "../API/Api";
import SearchIcon from "@mui/icons-material/Search";
import SentimentDissatisfiedIcon from "@mui/icons-material/SentimentDissatisfied";
import Tooltip from "@mui/material/Tooltip";
import { useTenantSelection } from "../Context/TenantSelectionProvider";
import InvoiceViewModal from "./InvoiceViewModal";
import CustomPagination from "./CustomPagination";
import InvoiceUploader from "./InvoiceUploader";

import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

export default function BasicTable() {
  const [invoices, setInvoices] = useState([]);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [uploaderOpen, setUploaderOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [saleType, setSaleType] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [invoiceDate, setInvoiceDate] = useState(null);
  const [goToPage, setGoToPage] = useState("");
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const theme = useTheme();
  const { selectedTenant } = useTenantSelection();
  const navigate = useNavigate();

  const apiKey = API_CONFIG.apiKeyLocal;

  // Helper function to format date to dd-mm-yyyy
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "N/A";

      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();

      return `${day}-${month}-${year}`;
    } catch (error) {
      return "N/A";
    }
  };

  // Helper function to get status color
  const getStatusColor = (status) => {
    switch (status) {
      case "draft":
        return "#ff9800"; // Orange
      case "saved":
        return "#2196f3"; // Blue
      case "validated":
        return "#9c27b0"; // Purple
      case "submitted":
        return "#ff9800"; // Orange (same as draft for now)
      case "posted":
        return "#4caf50"; // Green
      default:
        return "#757575"; // Grey
    }
  };

  // Helper function to get status display text
  const getStatusText = (status) => {
    switch (status) {
      case "draft":
        return "Draft";
      case "saved":
        return "Saved";
      case "validated":
        return "Validated";
      case "submitted":
        return "Submitted";
      case "posted":
        return "Posted";
      default:
        return "Unknown";
    }
  };

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500); // 500ms delay

    return () => clearTimeout(timer);
  }, [search]);

  const getMyInvoices = async () => {
    setLoading(true);
    try {
      if (!selectedTenant) {
        console.error("No Company selected");
        setLoading(false);
        return;
      }

      // Build query parameters for server-side pagination and filtering
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("limit", rowsPerPage.toString());

      if (debouncedSearch.trim()) {
        params.append("search", debouncedSearch.trim());
      }

      if (saleType && saleType !== "All") {
        params.append("sale_type", saleType);
      }

      if (statusFilter && statusFilter !== "All") {
        params.append("status", statusFilter);
      }

      if (invoiceDate) {
        params.append("start_date", dayjs(invoiceDate).format("YYYY-MM-DD"));
        params.append("end_date", dayjs(invoiceDate).format("YYYY-MM-DD"));
      }

      const response = await api.get(
        `/tenant/${selectedTenant.tenant_id}/invoices?${params.toString()}`
      );

      if (response.data.success) {
        console.log(response.data.data.invoices);
        setInvoices(response.data.data.invoices || []);
        // Update pagination info from server response
        if (response.data.data.pagination) {
          setTotalPages(response.data.data.pagination.total_pages);
          setTotalRecords(response.data.data.pagination.total_records);
        }
      } else {
        console.error("Failed to fetch invoices:", response.data.message);
        setInvoices([]);
      }
    } catch (error) {
      console.error("Error fetching invoices:", error);
      if (error.response?.status === 401) {
        alert("Authentication failed. Please log in again.");
      }
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTenant) {
      getMyInvoices();
    }
  }, [
    selectedTenant,
    page,
    rowsPerPage,
    debouncedSearch,
    saleType,
    statusFilter,
    invoiceDate,
  ]);

  const handleButtonClick = async (invoice) => {
    try {
      if (!selectedTenant) {
        alert("No Company selected");
        return;
      }

      // Get the auth token
      const token =
        localStorage.getItem("tenantToken") || localStorage.getItem("token");
      if (!token) {
        alert("Authentication token not found");
        return;
      }

      const link = `${apiKey}/print-invoice/${invoice.invoiceNumber}`;

      window.open(link, "_blank");
    } catch (error) {
      console.error("Error printing invoice:", error);
      if (error.response?.status === 401) {
        alert("Authentication failed. Please log in again.");
      } else {
        alert("Error printing invoice. Check console for details.");
      }
    }
  };

  const handleViewInvoice = async (invoice) => {
    try {
      if (!selectedTenant) {
        alert("No Company selected");
        return;
      }

      const response = await api.get(
        `/tenant/${selectedTenant.tenant_id}/invoices/${invoice.id}`
      );

      if (response.data.success) {
        setSelectedInvoice(response.data.data);
        setViewModalOpen(true);
      } else {
        console.error("Failed to fetch invoice:", response.data.message);
        alert("Failed to fetch invoice details");
      }
    } catch (error) {
      console.error("Error fetching invoice data:", error);
      if (error.response?.status === 401) {
        alert("Authentication failed. Please log in again.");
      } else {
        alert("Error fetching invoice details. Check console for details.");
      }
    }
  };

  const handleEditInvoice = async (invoice) => {
    try {
      if (!selectedTenant) {
        alert("No Company selected");
        return;
      }

      const response = await api.get(
        `/tenant/${selectedTenant.tenant_id}/invoices/${invoice.id}`
      );

      if (response.data.success) {
        setSelectedInvoice(response.data.data);

        if (invoice.status === "saved" || invoice.status === "draft") {
          // For saved and draft invoices, navigate to create form with data
          localStorage.setItem(
            "editInvoiceData",
            JSON.stringify(response.data.data)
          );
          navigate("/create-invoice");
        }
      } else {
        console.error("Failed to fetch invoice:", response.data.message);
        alert("Failed to fetch invoice details");
      }
    } catch (error) {
      console.error("Error fetching invoice data:", error);
      if (error.response?.status === 401) {
        alert("Authentication failed. Please log in again.");
      } else {
        alert("Error fetching invoice details. Check console for details.");
      }
    }
  };

  const handleBulkUpload = async (invoicesData) => {
    try {
      const response = await api.post(
        `/tenant/${selectedTenant.tenant_id}/invoices/bulk`,
        { invoices: invoicesData }
      );
      
      if (response.data.success) {
        const { summary, errors, warnings } = response.data.data;
        
        if (summary.failed > 0) {
          // Show detailed error information
          let errorDetails = errors
            .slice(0, 10)
            .map((err) => `Row ${err.row}: ${err.error}`)
            .join("\n");

          if (errors.length > 10) {
            errorDetails += `\n... and ${errors.length - 10} more errors`;
          }

          // Show error details in an alert
          alert(
            `Upload completed with issues:\n\n${summary.successful} invoices added successfully\n${summary.failed} invoices failed\n\nError details:\n${errorDetails}`
          );
        } else {
          // Refresh the invoices list
          getMyInvoices();
          alert(`Successfully uploaded ${summary.successful} invoices as drafts!`);
        }
        
        return response.data;
      } else {
        throw new Error(response.data.message || "Upload failed");
      }
    } catch (error) {
      console.error("Error in bulk upload:", error);
      let errorMessage = "Error uploading invoices.";
      if (error.response) {
        const { status, data } = error.response;
        if (status === 400) {
          errorMessage =
            data.message ||
            "Invalid data provided. Please check your file format.";
        } else if (status === 500) {
          errorMessage = "Server error occurred. Please try again later.";
        } else {
          errorMessage =
            data.message || "An error occurred while uploading invoices.";
        }
      }
      alert(errorMessage);
      throw error;
    }
  };

  const handleDeleteClick = async (invoice) => {
    const result = await Swal.fire({
      title: "Delete Invoice",
      text: `Are you sure you want to delete invoice ${invoice.invoiceNumber}? This action cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "Cancel",
      reverseButtons: true,
    });

    if (result.isConfirmed) {
      try {
        if (!selectedTenant) {
          Swal.fire("Error", "No Company selected", "error");
          return;
        }

        const response = await api.delete(
          `/tenant/${selectedTenant.tenant_id}/invoices/${invoice.id}`
        );

        if (response.data.success) {
          Swal.fire(
            "Deleted!",
            "Invoice has been deleted successfully.",
            "success"
          );
          // Refresh the invoice list
          getMyInvoices();
        } else {
          console.error("Failed to delete invoice:", response.data.message);
          Swal.fire("Error", "Failed to delete invoice", "error");
        }
      } catch (error) {
        console.error("Error deleting invoice:", error);
        if (error.response?.status === 401) {
          Swal.fire(
            "Error",
            "Authentication failed. Please log in again.",
            "error"
          );
        } else {
          Swal.fire(
            "Error",
            "Error deleting invoice. Please try again.",
            "error"
          );
        }
      }
    }
  };



  // Since we're using server-side pagination, we don't need client-side filtering
  // The server handles all filtering and pagination
  const filteredInvoices = invoices || [];

  return (
    <>
      {!selectedTenant ? (
        <Box
          sx={{
            textAlign: "center",
            p: 4,
            height: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.palette.background.default,
          }}
        >
          <Typography variant="h5" color="text.secondary" gutterBottom>
            No Company Selected
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Please select a Company to view invoices.
          </Typography>
        </Box>
      ) : loading ? (
        <Box sx={{ p: { xs: 1, sm: 3 }, maxWidth: 1200, mx: "auto" }}>
          {/* Header Section Skeleton */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              mb: 3,
            }}
          >
            <Skeleton variant="text" width={200} height={40} />
          </Box>

          {/* Search and Filter Controls Skeleton */}
          <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
            <Skeleton variant="rounded" width={260} height={40} />
            <Skeleton variant="rounded" width={160} height={40} />
            <Skeleton variant="rounded" width={140} height={40} />
            <Skeleton variant="rounded" width={140} height={40} />
            <Skeleton variant="rounded" width={120} height={40} />
          </Box>

          {/* Table Skeleton */}
          <TableContainer
            component={Paper}
            elevation={4}
            sx={{
              borderRadius: 3,
              overflow: "hidden",
              boxShadow: 4,
            }}
          >
            <Table
              size="small"
              sx={{
                minWidth: 650,
                "& .MuiTableCell-root": { py: 1.9, px: 1, fontSize: 12 },
                "& .MuiTableCell-head": {
                  py: 0.75,
                  fontSize: 13,
                  fontWeight: 700,
                },
              }}
            >
              <TableHead>
                <TableRow sx={{ background: "#EDEDED" }}>
                  {[...Array(9)].map((_, index) => (
                    <TableCell key={index}>
                      <Skeleton variant="text" width={80} height={20} />
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {[...Array(5)].map((_, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {[...Array(9)].map((_, colIndex) => (
                      <TableCell key={`${rowIndex}-${colIndex}`}>
                        <Skeleton
                          variant="text"
                          width={colIndex === 8 ? 120 : 100}
                          height={16}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination Skeleton */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mt: 2,
            }}
          >
            <Skeleton variant="text" width={200} height={20} />
            <Skeleton variant="rounded" width={300} height={32} />
          </Box>
        </Box>
      ) : (
        <Box sx={{ p: { xs: 1, sm: 3 }, maxWidth: 1200, mx: "auto" }}>
          {/* Header Section */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
              mb: 3,
            }}
          >
            <Typography
              variant="h4"
              sx={{
                fontWeight: 600,
                letterSpacing: 1,
                textShadow: "0 2px 8px #e3e3e3",
              }}
            >
              Your Invoices
            </Typography>
            <Button
              variant="outlined"
              color="primary"
              startIcon={<CloudUploadIcon />}
              onClick={() => setUploaderOpen(true)}
              sx={{ mr: 1 }}
            >
              Bulk Upload CSV/Excel
            </Button>
          </Box>
          {/* Search and Filter Controls */}
          <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
            <TextField
              variant="outlined"
              size="small"
              placeholder="Search by Invoice # or Buyer NTN"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{
                minWidth: 260,
                "& .MuiOutlinedInput-root": {
                  borderRadius: "8px",
                },
                "& input::placeholder": {
                  fontSize: "0.8rem",
                  opacity: 1,
                },
              }}
            />
            <TextField
              select
              label="Sale Type"
              size="small"
              value={saleType}
              onChange={(e) => {
                setSaleType(e.target.value);
                setPage(1);
              }}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="All">All</MenuItem>
              <MenuItem value="Sale Invoice">Sale Invoice</MenuItem>
              <MenuItem value="Debit Note">Debit Note</MenuItem>
            </TextField>
            <TextField
              select
              label="Status"
              size="small"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              sx={{ minWidth: 140 }}
            >
              <MenuItem value="All">All Status</MenuItem>
              <MenuItem value="draft">Draft</MenuItem>
              <MenuItem value="saved">Saved</MenuItem>
              <MenuItem value="posted">Posted</MenuItem>
            </TextField>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker
                label="Invoice Date"
                value={invoiceDate}
                onChange={(val) => {
                  setInvoiceDate(val);
                  setPage(1);
                }}
                slotProps={{
                  textField: { size: "small", sx: { minWidth: 140 } },
                }}
              />
            </LocalizationProvider>
            <TextField
              select
              label="Rows per page"
              size="small"
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setPage(1);
              }}
              sx={{ minWidth: 120 }}
            >
              {[5, 10, 20, 50].map((num) => (
                <MenuItem key={num} value={num}>
                  {num}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          {/* Empty State */}
          {filteredInvoices.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 8, color: "#90a4ae" }}>
              <SentimentDissatisfiedIcon sx={{ fontSize: 60, mb: 2 }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                No invoices found
              </Typography>
              <Typography variant="body2">
                Try adjusting your search or filter criteria.
              </Typography>
            </Box>
          ) : (
            <>
              <TableContainer
                component={Paper}
                elevation={4}
                sx={{
                  borderRadius: 3,
                  overflow: "hidden",
                  boxShadow: 4,
                }}
              >
                <Table
                  size="small"
                  sx={{
                    minWidth: 650,
                    "& .MuiTableCell-root": { py: 1.9, px: 1, fontSize: 12 },
                    "& .MuiTableCell-head": {
                      py: 0.75,
                      fontSize: 13,
                      fontWeight: 700,
                    },
                  }}
                  aria-label="invoice table"
                >
                  <TableHead>
                    <TableRow
                      sx={{
                        background: "#EDEDED",
                      }}
                    >
                      {[
                        "S.No",
                        "System ID",
                        "Invoice Number",
                        "Invoice Date",
                        "Invoice Type",
                        "Buyer",
                        "Buyer NTN",
                        "Product Description",
                        "Actions",
                      ].map((heading) => (
                        <TableCell
                          key={heading}
                          align={
                            heading === "S.No" ||
                            heading === "System ID" ||
                            heading === "Invoice Number" ||
                            heading === "Invoice Date"
                              ? "left"
                              : "center"
                          }
                          sx={{
                            fontWeight: "bold",
                            fontSize: 13,
                            letterSpacing: 0.3,
                          }}
                        >
                          {heading}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {filteredInvoices.map((row, index) => (
                      <TableRow
                        key={row._id || index}
                        sx={{
                          "&:hover": {
                            backgroundColor: "#EDEDED",
                            transition: "background-color 0.3s",
                          },
                        }}
                      >
                        <TableCell
                          component="th"
                          scope="row"
                          sx={{
                            fontWeight: 700,
                            fontSize: 13,
                            color: "#666",
                          }}
                        >
                          {(page - 1) * rowsPerPage + index + 1}
                        </TableCell>
                        <TableCell
                          component="th"
                          scope="row"
                          sx={{
                            fontWeight: 700,
                            fontSize: 13,
                            color: "#1976d2",
                          }}
                        >
                          {row.systemInvoiceId || "N/A"}
                        </TableCell>
                        <TableCell
                          component="th"
                          scope="row"
                          sx={{
                            fontWeight: 700,
                            fontSize: 13,
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.5,
                            }}
                          >
                            {row.invoiceNumber}
                            <Tooltip title="Copy Invoice Number">
                              <Button
                                variant="text"
                                size="small"
                                onClick={() => {
                                  navigator.clipboard.writeText(
                                    row.invoiceNumber
                                  );
                                  Swal.fire({
                                    title: "Copied!",
                                    text: `Invoice Number "${row.invoiceNumber}" copied to clipboard.`,
                                    icon: "success",
                                    toast: true,
                                    position: "top-end",
                                    showConfirmButton: false,
                                    timer: 3000,
                                    timerProgressBar: true,
                                  });
                                }}
                                sx={{
                                  minWidth: "24px",
                                  width: "24px",
                                  height: "24px",
                                  p: 0,
                                  color: "#607d8b",
                                  "&:hover": {
                                    color: "#1976d2",
                                  },
                                }}
                              >
                                <ContentCopyIcon fontSize="10px" />
                              </Button>
                            </Tooltip>
                          </Box>
                        </TableCell>
                        <TableCell
                          component="th"
                          scope="row"
                          sx={{ fontWeight: 500 }}
                        >
                          {formatDate(row.invoiceDate)}
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 500 }}>
                          {row.invoiceType || "N/A"}
                        </TableCell>
                        <TableCell align="center">
                          <Box
                            sx={{
                              fontWeight: 500,
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                              justifyContent: "center",
                            }}
                          >
                            <Box>{row.buyerBusinessName || "N/A"}</Box>
                            <Tooltip
                              title={getStatusText(row.status)}
                              placement="top"
                              arrow
                            >
                              <Box
                                component="span"
                                bgcolor={getStatusColor(row.status)}
                                sx={{
                                  width: "10px",
                                  height: "10px",
                                  borderRadius: "50%",
                                  display: "inline-block",
                                }}
                              ></Box>
                            </Tooltip>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ fontWeight: 500 }}>
                            {row.buyerNTNCNIC || "N/A"}
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          {row.items && row.items.length > 0
                            ? row.items
                                .map((item) => item.productDescription || "N/A")
                                .join(", ")
                            : "N/A"}
                        </TableCell>
                        <TableCell align="center">
                          <Box
                            sx={{
                              display: "flex",
                              justifyContent: "center",
                              gap: 1,
                            }}
                          >
                            {/* Print button for all invoice statuses */}
                            <Tooltip
                              title={`Print ${row.status === "posted" ? "Invoice" : row.status === "draft" ? "Draft Invoice" : "Saved Invoice"}`}
                            >
                              <Button
                                variant="outlined"
                                color={
                                  row.status === "posted" ? "success" : "info"
                                }
                                size="small"
                                onClick={() => handleButtonClick(row)}
                                sx={{
                                  minWidth: "32px",
                                  width: "32px",
                                  height: "32px",
                                  p: 0,
                                  "&:hover": {
                                    backgroundColor:
                                      row.status === "posted"
                                        ? "success.main"
                                        : "info.main",
                                    color:
                                      row.status === "posted"
                                        ? "success.contrastText"
                                        : "info.contrastText",
                                    borderColor:
                                      row.status === "posted"
                                        ? "success.main"
                                        : "info.main",
                                  },
                                }}
                              >
                                <PrintIcon fontSize="small" />
                              </Button>
                            </Tooltip>
                            <Tooltip title="View Invoice Details">
                              <Button
                                variant="outlined"
                                color="primary"
                                size="small"
                                onClick={() => handleViewInvoice(row)}
                                sx={{
                                  minWidth: "32px",
                                  width: "32px",
                                  height: "32px",
                                  p: 0,
                                  "&:hover": {
                                    backgroundColor: "primary.main",
                                    color: "primary.contrastText",
                                    borderColor: "primary.main",
                                  },
                                }}
                              >
                                <VisibilityIcon fontSize="small" />
                              </Button>
                            </Tooltip>
                            {(row.status === "draft" ||
                              row.status === "saved") && (
                              <>
                                <Tooltip
                                  title={`Edit ${row.status === "draft" ? "Draft" : "Saved"} Invoice`}
                                >
                                  <Button
                                    variant="outlined"
                                    color="warning"
                                    size="small"
                                    onClick={() => handleEditInvoice(row)}
                                    sx={{
                                      minWidth: "32px",
                                      width: "32px",
                                      height: "32px",
                                      p: 0,
                                      "&:hover": {
                                        backgroundColor: "warning.main",
                                        color: "warning.contrastText",
                                        borderColor: "warning.main",
                                      },
                                    }}
                                  >
                                    <EditIcon fontSize="small" />
                                  </Button>
                                </Tooltip>
                                <Tooltip title="Delete Invoice">
                                  <Button
                                    variant="outlined"
                                    color="error"
                                    size="small"
                                    onClick={() => handleDeleteClick(row)}
                                    sx={{
                                      minWidth: "32px",
                                      width: "32px",
                                      height: "32px",
                                      p: 0,
                                      "&:hover": {
                                        backgroundColor: "error.main",
                                        color: "error.contrastText",
                                        borderColor: "error.main",
                                      },
                                    }}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </Button>
                                </Tooltip>
                              </>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {/* Pagination Controls */}
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mt: 2,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Showing {(page - 1) * rowsPerPage + 1} to{" "}
                  {Math.min(page * rowsPerPage, totalRecords)} of {totalRecords}{" "}
                  invoices
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <CustomPagination
                    count={totalPages}
                    page={page}
                    onChange={(_, value) => setPage(value)}
                    showFirstButton
                    showLastButton
                    size="small"
                  />
                </Box>
              </Box>
            </>
          )}

          {/* Invoice View Modal */}
          <InvoiceViewModal
            open={viewModalOpen}
            onClose={() => setViewModalOpen(false)}
            invoice={selectedInvoice}
            onPrint={() => {
              if (selectedInvoice) {
                handleButtonClick(selectedInvoice);
              }
            }}
          />

          {/* Invoice Uploader Modal */}
          <InvoiceUploader
            isOpen={uploaderOpen}
            onClose={() => setUploaderOpen(false)}
            onUpload={handleBulkUpload}
            selectedTenant={selectedTenant}
          />

        </Box>
      )}
    </>
  );
}
