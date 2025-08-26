import React, { useState, useEffect } from "react";
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
  TextField,
  InputAdornment,
  MenuItem,
  Skeleton,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import SentimentDissatisfiedIcon from "@mui/icons-material/SentimentDissatisfied";
import CustomPagination from "./CustomPagination";

export default function BuyerTable({
  buyers,
  loading,
  onEdit,
  onDelete,
  onAdd,
  onUpload,
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [goToPage, setGoToPage] = useState("");

  // Filter buyers by search (all main fields)
  const filteredBuyers = buyers.filter((buyer) => {
    const searchLower = search.trim().toLowerCase();
    return (
      (buyer.buyerNTNCNIC || "").toLowerCase().includes(searchLower) ||
      (buyer.buyerBusinessName || "").toLowerCase().includes(searchLower) ||
      (buyer.buyerProvince || "").toLowerCase().includes(searchLower) ||
      (buyer.buyerAddress || "").toLowerCase().includes(searchLower) ||
      (buyer.buyerRegistrationType || "").toLowerCase().includes(searchLower)
    );
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredBuyers.length / rowsPerPage);
  const paginatedBuyers = filteredBuyers.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage
  );

  useEffect(() => {
    setPage(1);
  }, [search, rowsPerPage]);

  return (
    <Box sx={{ p: { xs: 1, sm: 3 }, maxWidth: 1200, mx: "auto" }}>
      {loading ? (
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
            <Box sx={{ flexGrow: 1 }} />
            <Skeleton variant="rounded" width={120} height={36} />
          </Box>

          {/* Search and Controls Skeleton */}
          <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
            <Skeleton variant="rounded" width={260} height={40} />
            <Skeleton variant="rounded" width={120} height={40} />
          </Box>

          {/* Table Skeleton */}
          <TableContainer
            component={Paper}
            elevation={4}
            sx={{ borderRadius: 3, overflow: "hidden", boxShadow: 4 }}
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
                  {[...Array(7)].map((_, index) => (
                    <TableCell key={index}>
                      <Skeleton variant="text" width={80} height={20} />
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {[...Array(5)].map((_, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {[...Array(7)].map((_, colIndex) => (
                      <TableCell key={`${rowIndex}-${colIndex}`}>
                        <Skeleton
                          variant="text"
                          width={colIndex === 6 ? 120 : 100}
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
        <>
          {/* Header Section */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
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
              Buyer Management
            </Typography>
            <Box sx={{ flexGrow: 1 }} />
            <Button 
              variant="outlined" 
              color="primary" 
              onClick={() => onUpload()}
              sx={{ mr: 1 }}
            >
              Upload CSV
            </Button>
            <Button variant="contained" color="primary" onClick={() => onAdd()}>
              Add Buyer
            </Button>
          </Box>

          {/* Search and Controls */}
          <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
            <TextField
              variant="outlined"
              size="small"
              placeholder="Search by any field"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{
                minWidth: 260,
                "& .MuiOutlinedInput-root": { borderRadius: "8px" },
                "& input::placeholder": { fontSize: "0.8rem", opacity: 1 },
              }}
            />
            <TextField
              select
              label="Rows per page"
              size="small"
              value={rowsPerPage}
              onChange={(e) => setRowsPerPage(Number(e.target.value))}
              sx={{ minWidth: 120 }}
            >
              {[5, 10, 20, 50].map((num) => (
                <MenuItem key={num} value={num}>
                  {num}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          {/* Empty State or Table */}
          {paginatedBuyers.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 8, color: "#90a4ae" }}>
              <SentimentDissatisfiedIcon sx={{ fontSize: 60, mb: 2 }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                No buyers found
              </Typography>
              <Typography variant="body2">
                Try adjusting your search.
              </Typography>
            </Box>
          ) : (
            <>
              <TableContainer
                component={Paper}
                elevation={4}
                sx={{ borderRadius: 3, overflow: "hidden", boxShadow: 4 }}
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
                  aria-label="buyer table"
                >
                  <TableHead>
                    <TableRow sx={{ background: "#EDEDED" }}>
                      {[
                        "S.No",
                        "NTN/CNIC",
                        "Business Name",
                        "Province",
                        "Address",
                        "Registration Type",
                        "Actions",
                      ].map((heading) => (
                        <TableCell
                          key={heading}
                          align={
                            heading === "S.No" ||
                            heading === "NTN/CNIC" ||
                            heading === "Business Name"
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
                    {paginatedBuyers.map((buyer, index) => (
                      <TableRow
                        key={buyer.id || index}
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
                          sx={{ fontWeight: 700, fontSize: 13 }}
                        >
                          {(page - 1) * rowsPerPage + index + 1}
                        </TableCell>
                        <TableCell
                          component="th"
                          scope="row"
                          sx={{ fontWeight: 700, fontSize: 13 }}
                        >
                          {buyer.buyerNTNCNIC}
                        </TableCell>
                        <TableCell align="left" sx={{ fontWeight: 500 }}>
                          {buyer.buyerBusinessName}
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 500 }}>
                          {buyer.buyerProvince}
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 500 }}>
                          {buyer.buyerAddress}
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 500 }}>
                          {buyer.buyerRegistrationType}
                        </TableCell>
                        <TableCell align="center">
                          <Box
                            sx={{
                              display: "flex",
                              justifyContent: "center",
                              gap: 1,
                            }}
                          >
                            <Button
                              onClick={() => onEdit(buyer)}
                              variant="outlined"
                              color="primary"
                              size="small"
                              sx={{
                                px: 0.75,
                                py: 0.25,
                                minWidth: "auto",
                                fontSize: 11,
                                lineHeight: 1.4,
                                "&:hover": {
                                  backgroundColor: "primary.main",
                                  color: "primary.contrastText",
                                  borderColor: "primary.main",
                                },
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              onClick={() => onDelete(buyer.id)}
                              variant="outlined"
                              color="error"
                              size="small"
                              sx={{
                                px: 0.75,
                                py: 0.25,
                                minWidth: "auto",
                                fontSize: 11,
                                lineHeight: 1.4,
                                "&:hover": {
                                  backgroundColor: "error.main",
                                  color: "error.contrastText",
                                  borderColor: "error.main",
                                },
                              }}
                            >
                              Delete
                            </Button>
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
                  {Math.min(page * rowsPerPage, filteredBuyers.length)} of{" "}
                  {filteredBuyers.length} buyers
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
        </>
      )}
    </Box>
  );
}
