import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Box, TextField, Typography, CircularProgress } from "@mui/material";
import { Autocomplete } from "@mui/material";
import hsCodeCache from "../utils/hsCodeCache";

const OptimizedHSCodeSelector = ({
  index,
  item,
  handleItemChange,
  environment = "sandbox",
  label = "HS Code",
  placeholder = "Search HS Code...",
}) => {
  const [hsCodeList, setHsCodeList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [filteredOptions, setFilteredOptions] = useState([]);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Load HS codes with caching
  useEffect(() => {
    const loadHSCodes = async () => {
      setLoading(true);
      try {
        const data = await hsCodeCache.getHSCodes(environment);
        setHsCodeList(data);
      } catch (error) {
        console.error("Error loading HS codes:", error);
        setHsCodeList([]);
      } finally {
        setLoading(false);
      }
    };

    loadHSCodes();
  }, [environment]);

  // Filter options based on search term
  useEffect(() => {
    const updateFilteredOptions = async () => {
      if (!debouncedSearchTerm || debouncedSearchTerm.length < 2) {
        setFilteredOptions(hsCodeList.slice(0, 100));
        return;
      }

      try {
        const results = await hsCodeCache.searchHSCodesFromBackend(
          debouncedSearchTerm,
          50,
          environment
        );
        setFilteredOptions(results);
      } catch (error) {
        console.error("Error searching HS codes:", error);
        const localResults = hsCodeCache.searchHSCodes(debouncedSearchTerm, 50);
        setFilteredOptions(localResults);
      }
    };

    updateFilteredOptions();
  }, [hsCodeList, debouncedSearchTerm, environment]);

  // Handle HS code selection
  const handleHSCodeChange = useCallback(
    (_, newValue) => {
      console.log("HS Code Selection:", newValue);
      const hsCodeValue = newValue ? newValue.hS_CODE : "";

      // Validate hsCode length (max 50 characters)
      if (hsCodeValue && hsCodeValue.length > 50) {
        console.warn(
          `HS Code "${hsCodeValue}" is too long (${hsCodeValue.length} characters). Truncating to 50 characters.`
        );
        handleItemChange(index, "hsCode", hsCodeValue.substring(0, 50));
      } else {
        handleItemChange(index, "hsCode", hsCodeValue);
      }
    },
    [index, handleItemChange]
  );

  // Get current value
  const currentValue = useMemo(() => {
    // Extract HS code from description if it contains a dash separator
    // Format: "8432.1010 - NUCLEAR REACTOR, BOILERS, MACHINERY AN"
    let extractedHsCode = item.hsCode;
    if (item.hsCode && item.hsCode.includes(" - ")) {
      extractedHsCode = item.hsCode.split(" - ")[0].trim();
    }

    return hsCodeList.find((code) => code.hS_CODE === extractedHsCode) || null;
  }, [hsCodeList, item.hsCode]);

  // Get description for selected HS code
  const selectedDescription = useMemo(() => {
    // Extract HS code from description if it contains a dash separator
    let extractedHsCode = item.hsCode;
    if (item.hsCode && item.hsCode.includes(" - ")) {
      extractedHsCode = item.hsCode.split(" - ")[0].trim();
    }

    return (
      hsCodeList.find((code) => code.hS_CODE === extractedHsCode)
        ?.description || ""
    );
  }, [hsCodeList, item.hsCode]);

  return (
    <Box sx={{ width: "100%" }}>
      <Autocomplete
        fullWidth
        size="small"
        options={filteredOptions}
        getOptionLabel={(option) =>
          `${option.hS_CODE} - ${option.description || ""}`
        }
        value={currentValue}
        onChange={handleHSCodeChange}
        onInputChange={(_, newInputValue) => {
          setSearchTerm(newInputValue);
        }}
        loading={loading}
        filterOptions={(options) => {
          return options;
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            placeholder={placeholder}
            variant="outlined"
            size="small"
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading ? (
                    <CircularProgress color="inherit" size={20} />
                  ) : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
        renderOption={(props, option) => {
          const { key, ...otherProps } = props;
          return (
            <Box component="li" key={key} {...otherProps}>
              <Box>
                <Typography variant="body1" fontWeight="bold">
                  {option.hS_CODE}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {option.description || "No description available"}
                </Typography>
              </Box>
            </Box>
          );
        }}
        isOptionEqualToValue={(option, value) =>
          option.hS_CODE === value.hS_CODE
        }
        noOptionsText={
          debouncedSearchTerm.length < 2
            ? "Type at least 2 characters to search..."
            : "No HS codes found"
        }
      />

      {selectedDescription && (
        <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
          {selectedDescription}
        </Typography>
      )}

      <Typography
        variant="caption"
        sx={{ mt: 0.5, color: "text.disabled", fontSize: "0.75rem" }}
      >
        Maximum 50 characters allowed
      </Typography>
    </Box>
  );
};

export default OptimizedHSCodeSelector;
