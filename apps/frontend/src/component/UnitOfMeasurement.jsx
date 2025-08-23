import { Box, FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import React, { useEffect, useState } from "react";
import hsCodeCache from "../utils/hsCodeCache";

const UnitOfMeasurement = ({ index, item, handleItemChange, hsCode }) => {
  const [uom, setUom] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const getUoM = async () => {
      if (!hsCode) return;

      // Extract HS code from description if it contains a dash separator
      // Format: "8432.1010 - NUCLEAR REACTOR, BOILERS, MACHINERY AN"
      let extractedHsCode = hsCode;
      if (hsCode.includes(" - ")) {
        extractedHsCode = hsCode.split(" - ")[0].trim();
      }

      // Special handling for scenario SN018 with rate containing "/bill"
      if (item.rate && item.rate.includes("/bill")) {
        handleItemChange(index, "uoM", "Bill of lading");
        // Add "Bill of lading" as an option for the dropdown
        setUom([{ uoM_ID: "bill_of_lading", description: "Bill of lading" }]);
        return;
      }

      // Special handling for scenario SN019 with rate containing "/SqY"
      if (item.rate && item.rate.includes("/SqY")) {
        handleItemChange(index, "uoM", "SqY");
        // Add "SqY" as an option for the dropdown
        setUom([{ uoM_ID: "sqy", description: "SqY" }]);
        return;
      }
      setIsLoading(true);

      try {
        // Use the new UOM caching system with extracted HS code
        const response = await hsCodeCache.getUOM(extractedHsCode);

        if (response && Array.isArray(response)) {
          setUom(response);
          // Auto-select if only one UOM is returned and not already set
          if (response.length === 1 && !item.uoM) {
            handleItemChange(index, "uoM", response[0].description);
          }
        } else {
          setUom([]);
        }
      } catch (error) {
        // The caching system should have already provided fallback data
        // but if it didn't, we'll set an empty array
        setUom([]);
      } finally {
        setIsLoading(false);
      }
    };

    getUoM();
  }, [hsCode, item.rate]);

  const handleUOMChange = (event) => {
    const selectedUOM = event.target.value;
    handleItemChange(index, "uoM", selectedUOM);
  };

  // ✅ Early return AFTER hooks
  if (!hsCode) {
    return null;
  }

  return (
    <Box sx={{ flex: "1 1 18%", minWidth: "150px" }}>
      <FormControl fullWidth size="small">
        <InputLabel id={`sro-item-${index}`}>
          Unit of Measurement {isLoading && "(Loading...)"}
        </InputLabel>
        <Select
          labelId={`uom-${index}`}
          value={item.uoM || ""}
          label={`Unit of Measure (UoM) ${isLoading ? "(Loading...)" : ""}`}
          onChange={handleUOMChange}
          disabled={isLoading}
        >
          {uom.map((curElem) => (
            <MenuItem key={curElem.uoM_ID} value={curElem.description}>
              {curElem.description}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
};

export default UnitOfMeasurement;
