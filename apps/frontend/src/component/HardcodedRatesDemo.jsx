import React, { useState } from "react";
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Paper,
  Grid,
  Chip,
} from "@mui/material";
import {
  TRANSACTION_TYPE_RATES,
  getRatesForTransactionType,
} from "../utils/hardcodedRates";

const HardcodedRatesDemo = () => {
  const [selectedTransactionType, setSelectedTransactionType] = useState("");
  const [selectedRates, setSelectedRates] = useState([]);

  // Get all available transaction types
  const transactionTypes = [
    { id: 75, desc: "Goods at standard rate (default)" },
    { id: 24, desc: "Goods at Reduced Rate" },
    { id: 80, desc: "Goods at zero-rate" },
    { id: 85, desc: "Petroleum Products" },
    { id: 62, desc: "Electricity Supply to Retailers" },
    { id: 129, desc: "SIM" },
    { id: 77, desc: "Gas to CNG stations" },
    { id: 122, desc: "Mobile Phones" },
    { id: 25, desc: "Processing/Conversion of Goods" },
    { id: 23, desc: "3rd Schedule Goods" },
    { id: 21, desc: "Goods (FED in ST Mode)" },
    { id: 22, desc: "Services (FED in ST Mode)" },
    { id: 18, desc: "Services" },
    { id: 81, desc: "Exempt goods" },
    { id: 82, desc: "DTRE goods" },
    { id: 130, desc: "Cotton ginners" },
    { id: 132, desc: "Electric Vehicle" },
    { id: 134, desc: "Cement /Concrete Block" },
    { id: 84, desc: "Telecommunication services" },
    { id: 123, desc: "Steel melting and re-rolling" },
    { id: 125, desc: "Ship breaking" },
    { id: 115, desc: "Potassium Chlorate" },
    { id: 178, desc: "CNG Sales" },
    { id: 181, desc: "Toll Manufacturing" },
    { id: 138, desc: "Non-Adjustable Supplies" },
    { id: 139, desc: "Goods as per SRO.297(|)/2023" },
  ];

  const handleTransactionTypeChange = (event) => {
    const transactionTypeId = event.target.value;
    setSelectedTransactionType(transactionTypeId);

    if (transactionTypeId) {
      const rates = getRatesForTransactionType(transactionTypeId);
      setSelectedRates(rates);
    } else {
      setSelectedRates([]);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: "auto" }}>
      <Typography
        variant="h4"
        gutterBottom
        sx={{ color: "#1976d2", fontWeight: "bold" }}
      >
        Hardcoded Rates Demo
      </Typography>

      <Typography variant="body1" sx={{ mb: 3, color: "#666" }}>
        This demo shows how rates are automatically populated based on the
        selected transaction type. No API calls are needed - all rates are
        hardcoded for instant access.
      </Typography>

      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel id="transaction-type-label">
                Transaction Type
              </InputLabel>
              <Select
                labelId="transaction-type-label"
                value={selectedTransactionType}
                label="Transaction Type"
                onChange={handleTransactionTypeChange}
              >
                <MenuItem value="">
                  <em>Select a transaction type</em>
                </MenuItem>
                {transactionTypes.map((type) => (
                  <MenuItem key={type.id} value={type.id}>
                    {type.id} - {type.desc}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={6}>
            <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
              <Typography variant="body2" sx={{ color: "#666" }}>
                {selectedTransactionType
                  ? `Selected: ${transactionTypes.find((t) => t.id === selectedTransactionType)?.desc}`
                  : "Please select a transaction type to see available rates"}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {selectedTransactionType && (
        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ color: "#1976d2" }}>
            Available Rates for Transaction Type {selectedTransactionType}
          </Typography>

          {selectedRates.length > 0 ? (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {selectedRates.map((rate) => (
                <Chip
                  key={rate.ratE_ID}
                  label={`${rate.ratE_DESC} (ID: ${rate.ratE_ID})`}
                  variant="outlined"
                  color="primary"
                  sx={{
                    fontSize: "14px",
                    "& .MuiChip-label": { px: 2, py: 1 },
                  }}
                />
              ))}
            </Box>
          ) : (
            <Typography
              variant="body2"
              sx={{ color: "#666", fontStyle: "italic" }}
            >
              No rates available for this transaction type.
            </Typography>
          )}

          <Box sx={{ mt: 2, p: 2, bgcolor: "#f5f5f5", borderRadius: 1 }}>
            <Typography variant="body2" sx={{ color: "#666" }}>
              <strong>Total Rates:</strong> {selectedRates.length} |
              <strong>Transaction Type:</strong>{" "}
              {
                transactionTypes.find((t) => t.id === selectedTransactionType)
                  ?.desc
              }
            </Typography>
          </Box>
        </Paper>
      )}

      <Paper elevation={3} sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ color: "#1976d2" }}>
          Implementation Details
        </Typography>

        <Typography variant="body2" sx={{ mb: 2 }}>
          <strong>Benefits of Hardcoded Rates:</strong>
        </Typography>

        <Box component="ul" sx={{ pl: 3, mb: 2 }}>
          <li>Instant rate loading - no API delays</li>
          <li>No dependency on FBR API availability</li>
          <li>Consistent rate data across all users</li>
          <li>Reduced server load and API calls</li>
          <li>Better user experience with immediate feedback</li>
        </Box>

        <Typography variant="body2" sx={{ mb: 2 }}>
          <strong>How it works:</strong>
        </Typography>

        <Box component="ol" sx={{ pl: 3 }}>
          <li>User selects a transaction type</li>
          <li>Component automatically loads rates from hardcoded data</li>
          <li>Rates dropdown is populated instantly</li>
          <li>No network requests or loading states</li>
          <li>Fallback to API calls only when hardcoded data is unavailable</li>
        </Box>
      </Paper>
    </Box>
  );
};

export default HardcodedRatesDemo;
