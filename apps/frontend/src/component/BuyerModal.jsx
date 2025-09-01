import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Divider,
  Stack,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  IconButton,
  CircularProgress,
  Alert,
  Snackbar,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { fetchData } from "../API/GetApi";
import { useTenantSelection } from "../Context/TenantSelectionProvider";

// Utility function to wait for a specified time
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const BuyerModal = ({ isOpen, onClose, onSave, buyer }) => {
  const { tokensLoaded, retryTokenFetch, validateAndRefreshToken } =
    useTenantSelection();
  const [formData, setFormData] = useState({
    buyerNTNCNIC: "",
    buyerBusinessName: "",
    buyerProvince: "",
    buyerAddress: "",
    buyerRegistrationType: "",
  });
  const [provinces, setProvinces] = useState([]);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showError, setShowError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [maxRetries] = useState(3);
  const [checkingBuyerRegistration, setCheckingBuyerRegistration] =
    useState(false);
  const [buyerRegistrationHint, setBuyerRegistrationHint] = useState("");
  const [ntnDebounceTimer, setNtnDebounceTimer] = useState(null);
  const [registrationTypeLocked, setRegistrationTypeLocked] = useState(false);

  // Reset form data when modal opens
  useEffect(() => {
    if (isOpen) {
      // Reset error and success states
      setErrorMessage("");
      setShowError(false);
      setIsSubmitting(false);
      setRetryCount(0);

      if (buyer) {
        // If editing an existing buyer, populate the form
        setFormData({
          buyerNTNCNIC: buyer.buyerNTNCNIC || "",
          buyerBusinessName: buyer.buyerBusinessName || "",
          buyerProvince: buyer.buyerProvince || "",
          buyerAddress: buyer.buyerAddress || "",
          buyerRegistrationType: buyer.buyerRegistrationType || "",
        });
        setRegistrationTypeLocked(false);
      } else {
        // If adding a new buyer, reset the form to empty
        setFormData({
          buyerNTNCNIC: "",
          buyerBusinessName: "",
          buyerProvince: "",
          buyerAddress: "",
          buyerRegistrationType: "",
        });
        setRegistrationTypeLocked(false);
      }
    }
  }, [isOpen, buyer]);

  // Enhanced function to fetch provinces with retry mechanism
  const handleFetchProvinces = async () => {
    setLoadingProvinces(true);
    setErrorMessage("");
    setShowError(false);

    try {
      // First, try to validate and refresh token if needed
      const tokenValid = await validateAndRefreshToken();

      if (!tokenValid && retryCount < maxRetries) {
        console.log(
          `Token validation failed, attempting retry ${retryCount + 1}/${maxRetries}`
        );
        setRetryCount((prev) => prev + 1);

        // Wait a bit before retrying (exponential backoff)
        await wait(1000 * Math.pow(2, retryCount));

        // Try to fetch provinces again
        await handleFetchProvinces();
        return;
      }

      if (!tokenValid) {
        throw new Error(
          "Unable to load tokens after multiple attempts. Please refresh the page and try again."
        );
      }

      const response = await fetchData("pdi/v1/provinces");
      console.log("Provinces fetched:", response);
      setProvinces(response);
      // Store in localStorage for other components to use
      localStorage.setItem("provinceResponse", JSON.stringify(response));
      setRetryCount(0); // Reset retry count on success
    } catch (error) {
      console.error("Error fetching provinces:", error);

      // If it's a token-related error and we haven't exceeded retries, try again
      if (
        (error.message.includes("token") || error.message.includes("Token")) &&
        retryCount < maxRetries
      ) {
        console.log(
          `Token error detected, attempting retry ${retryCount + 1}/${maxRetries}`
        );
        setRetryCount((prev) => prev + 1);

        // Wait before retrying (exponential backoff)
        await wait(1000 * Math.pow(2, retryCount));

        // Try to fetch provinces again
        await handleFetchProvinces();
        return;
      }

      setErrorMessage(
        error.message || "Failed to fetch provinces. Please try again."
      );
      setShowError(true);
      setProvinces([]);
    } finally {
      setLoadingProvinces(false);
    }
  };

  // Auto-fetch provinces when modal opens and tokens are loaded
  useEffect(() => {
    if (isOpen && tokensLoaded && provinces.length === 0) {
      // Small delay to ensure everything is properly initialized
      const timer = setTimeout(() => {
        handleFetchProvinces();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [isOpen, tokensLoaded]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();

    // Don't proceed if already submitting
    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      // Basic validation for required fields
      const {
        buyerNTNCNIC,
        buyerBusinessName,
        buyerProvince,
        buyerAddress,
        buyerRegistrationType,
      } = formData;
      if (
        !buyerNTNCNIC ||
        !buyerBusinessName ||
        !buyerProvince ||
        !buyerAddress ||
        !buyerRegistrationType
      ) {
        throw new Error("Please fill in all required fields.");
      }

      // Proceed with saving
      onSave(formData);
    } catch (error) {
      console.error("Error during save process:", error);

      // Show error message to user
      setErrorMessage(error.message || "Error saving buyer. Please try again.");
      setShowError(true);

      // Don't close modal on error - let user fix the issue
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
  };

  const checkBuyerRegistration = async (registrationNo) => {
    console.log("checkBuyerRegistration() -> registrationNo:", registrationNo);
    if (!registrationNo) return;
    try {
      setCheckingBuyerRegistration(true);
      setBuyerRegistrationHint("");

      const response = await fetch(
        "https://paramount-corp.inplsoftwares.online/api/buyer-check",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ registrationNo }),
        }
      );

      console.log(
        "FBR buyer check response status:",
        response.status,
        "ok:",
        response.ok
      );

      const data = await response.json().catch(() => ({}));

      console.log("FBR buyer check parsed data:", data);

      let derivedRegistrationType = "";
      if (data && typeof data.REGISTRATION_TYPE === "string") {
        derivedRegistrationType =
          data.REGISTRATION_TYPE.toLowerCase() === "registered"
            ? "Registered"
            : "Unregistered";
      } else {
        let isRegistered = false;
        if (typeof data === "boolean") {
          isRegistered = data;
        } else if (data) {
          isRegistered =
            data.isRegistered === true ||
            data.registered === true ||
            (typeof data.status === "string" &&
              data.status.toLowerCase() === "registered") ||
            (typeof data.registrationType === "string" &&
              data.registrationType.toLowerCase() === "registered");
        }
        derivedRegistrationType = isRegistered ? "Registered" : "Unregistered";
      }

      setFormData((prev) => ({
        ...prev,
        buyerRegistrationType: derivedRegistrationType,
      }));

      setBuyerRegistrationHint(
        derivedRegistrationType === "Registered"
          ? "Auto-filled as Registered from FBR"
          : "Auto-filled as Unregistered from FBR"
      );
      setRegistrationTypeLocked(true);
    } catch (err) {
      console.error("Buyer registration check failed:", err);
      setBuyerRegistrationHint(
        "Could not verify from FBR. You can choose manually."
      );
      setRegistrationTypeLocked(false);
    } finally {
      setCheckingBuyerRegistration(false);
    }
  };

  // Debounce API call when NTN/CNIC changes so user doesn't have to blur
  useEffect(() => {
    if (!isOpen) return;
    const value = (formData.buyerNTNCNIC || "").trim();
    if (ntnDebounceTimer) clearTimeout(ntnDebounceTimer);
    if (!value) return;
    const id = setTimeout(() => {
      console.log("Debounce fire -> checking buyer with:", value);
      checkBuyerRegistration(value);
    }, 700);
    setNtnDebounceTimer(id);
    return () => clearTimeout(id);
  }, [formData.buyerNTNCNIC, isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <Snackbar
        open={showError}
        autoHideDuration={6000}
        onClose={() => setShowError(false)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          onClose={() => setShowError(false)}
          severity="error"
          sx={{
            width: "100%",
            backgroundColor: "rgba(255, 245, 245, 0.9)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255, 0, 0, 0.1)",
            color: "#d32f2f",
          }}
        >
          {errorMessage}
        </Alert>
      </Snackbar>

      {/* Animated liquid background */}
      <Box
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 1299,
          background: `
            radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(119, 167, 255, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 40% 40%, rgba(120, 219, 255, 0.3) 0%, transparent 50%)
          `,
          animation: "liquidFloat 6s ease-in-out infinite alternate",
          "@keyframes liquidFloat": {
            "0%": {
              transform: "scale(1) rotate(0deg)",
            },
            "100%": {
              transform: "scale(1.1) rotate(2deg)",
            },
          },
        }}
      />

      {/* Main modal backdrop */}
      <Box
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          backgroundColor: "rgba(0, 0, 0, 0.3)",
          backdropFilter: "blur(8px)",
          zIndex: 1300,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: { xs: 1, sm: 2 },
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, sm: 3 },
            width: { xs: "95%", sm: "80%", md: "60%", lg: "50%" },
            maxWidth: { xs: "100%", sm: 450, md: 500 },
            maxHeight: { xs: "80vh", sm: "95vh" },
            borderRadius: { xs: 2, sm: 3 },
            position: "relative",
            // Frosted glass effect like Apple notifications
            backgroundColor: "rgba(255, 255, 255, 0.55)",
            backdropFilter: "blur(20px) saturate(180%)",
            border: "1px solid rgba(255, 255, 255, 0.3)",
            boxShadow: `
              0 8px 32px rgba(0, 0, 0, 0.12),
              0 2px 8px rgba(0, 0, 0, 0.08),
              inset 0 1px 0 rgba(255, 255, 255, 0.6)
            `,
            // Smooth entrance animation
            animation: "modalSlideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
            "@keyframes modalSlideUp": {
              "0%": {
                opacity: 0,
                transform: "translateY(30px) scale(0.95)",
              },
              "100%": {
                opacity: 1,
                transform: "translateY(0) scale(1)",
              },
            },
          }}
        >
          {/* Close button with hover effect */}
          <IconButton
            onClick={onClose}
            sx={{
              position: "absolute",
              top: { xs: 8, sm: 12 },
              right: { xs: 8, sm: 12 },
              backgroundColor: "rgba(0, 0, 0, 0.05)",
              color: "#666",
              width: { xs: 28, sm: 32 },
              height: { xs: 28, sm: 32 },
              zIndex: 1,
              "&:hover": {
                backgroundColor: "rgba(0, 0, 0, 0.1)",
                transform: "scale(1.1)",
              },
              transition: "all 0.2s ease-in-out",
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>

          {/* Title with modern typography */}
          <Typography
            variant="h5"
            fontWeight={600}
            align="center"
            gutterBottom
            sx={{
              color: "#1a1a1a",
              mt: { xs: 0.5, sm: 1 },
              mb: { xs: 1.5, sm: 2 },
              letterSpacing: "-0.02em",
              fontSize: { xs: "1.1rem", sm: "1.3rem" },
            }}
          >
            {buyer ? "Edit Buyer" : "Add Buyer"}
          </Typography>

          {/* Form container */}
          <Box
            component="form"
            noValidate
            onSubmit={handleSave}
            sx={{ width: "100%" }}
          >
            <Stack spacing={{ xs: 1, sm: 1.5 }}>
              {/* Modern text fields with frosted styling */}
              <TextField
                label="NTN/CNIC"
                name="buyerNTNCNIC"
                value={formData.buyerNTNCNIC}
                onChange={(e) => {
                  console.log("NTN/CNIC onChange:", e.target.value);
                  handleChange(e);
                }}
                onBlur={(e) => {
                  console.log("NTN/CNIC onBlur ->", e.target.value);
                  checkBuyerRegistration(e.target.value?.trim());
                }}
                fullWidth
                required
                variant="outlined"
                placeholder="Enter NTN/CNIC"
                size="small"
                sx={{
                  "& .MuiOutlinedInput-root": {
                    backgroundColor: "rgba(255, 255, 255, 0.6)",
                    backdropFilter: "blur(10px)",
                    borderRadius: 2,
                    "& fieldset": {
                      borderColor: "rgba(0, 0, 0, 0.12)",
                      borderWidth: 1,
                    },
                    "&:hover fieldset": {
                      borderColor: "rgba(0, 0, 0, 0.2)",
                    },
                    "&.Mui-focused fieldset": {
                      borderColor: "#007AFF",
                      borderWidth: 2,
                    },
                  },
                  "& .MuiInputLabel-root": {
                    color: "#1a1a1a",
                    fontWeight: 500,
                  },
                  "& .MuiOutlinedInput-input": {
                    color: "#1a1a1a",
                    fontWeight: 400,
                  },
                }}
                helperText={
                  checkingBuyerRegistration
                    ? "Checking registration from FBR..."
                    : buyerRegistrationHint || " "
                }
              />

              <TextField
                label="Business Name"
                name="buyerBusinessName"
                value={formData.buyerBusinessName}
                onChange={handleChange}
                fullWidth
                required
                variant="outlined"
                size="small"
                sx={{
                  "& .MuiOutlinedInput-root": {
                    backgroundColor: "rgba(255, 255, 255, 0.6)",
                    backdropFilter: "blur(10px)",
                    borderRadius: 2,
                    "& fieldset": {
                      borderColor: "rgba(0, 0, 0, 0.12)",
                    },
                    "&:hover fieldset": {
                      borderColor: "rgba(0, 0, 0, 0.2)",
                    },
                    "&.Mui-focused fieldset": {
                      borderColor: "#007AFF",
                      borderWidth: 2,
                    },
                  },
                  "& .MuiInputLabel-root": {
                    color: "#1a1a1a",
                    fontWeight: 500,
                  },
                  "& .MuiOutlinedInput-input": {
                    color: "#1a1a1a",
                  },
                }}
              />

              {/* Province section with Get Province button */}
              <Box>
                <FormControl
                  fullWidth
                  required
                  size="small"
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      backgroundColor: "rgba(255, 255, 255, 0.6)",
                      backdropFilter: "blur(10px)",
                      borderRadius: 2,
                      "& fieldset": {
                        borderColor: "rgba(0, 0, 0, 0.12)",
                      },
                      "&:hover fieldset": {
                        borderColor: "rgba(0, 0, 0, 0.2)",
                      },
                      "&.Mui-focused fieldset": {
                        borderColor: "#007AFF",
                        borderWidth: 2,
                      },
                    },
                    "& .MuiInputLabel-root": {
                      color: "#1a1a1a",
                      fontWeight: 500,
                    },
                    "& .MuiSelect-select": {
                      color: "#1a1a1a",
                    },
                  }}
                >
                  <InputLabel id="buyerProvince-label">Province</InputLabel>
                  <Select
                    labelId="buyerProvince-label"
                    name="buyerProvince"
                    value={formData.buyerProvince}
                    label="Province"
                    onChange={handleChange}
                    disabled={loadingProvinces}
                    MenuProps={{
                      PaperProps: {
                        sx: {
                          backgroundColor: "rgba(255, 255, 255, 0.9)",
                          backdropFilter: "blur(20px)",
                          border: "1px solid rgba(255, 255, 255, 0.3)",
                          borderRadius: 2,
                          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
                          maxHeight: "150px",
                        },
                      },
                    }}
                  >
                    {provinces.length === 0 ? (
                      <MenuItem disabled>
                        {loadingProvinces
                          ? `Loading provinces...${retryCount > 0 ? ` (Retry ${retryCount}/${maxRetries})` : ""}`
                          : "No provinces available"}
                      </MenuItem>
                    ) : (
                      provinces.map((province) => (
                        <MenuItem
                          key={province.stateProvinceCode}
                          value={province.stateProvinceDesc}
                          sx={{
                            color: "#1a1a1a",
                            "&:hover": {
                              backgroundColor: "rgba(0, 122, 255, 0.1)",
                            },
                          }}
                        >
                          {province.stateProvinceDesc}
                        </MenuItem>
                      ))
                    )}
                  </Select>
                </FormControl>

                {/* Get Province Button */}
                <Button
                  onClick={handleFetchProvinces}
                  disabled={loadingProvinces}
                  variant="outlined"
                  size="small"
                  sx={{
                    mt: 0.5,
                    color: "#007AFF",
                    borderColor: "#007AFF",
                    backgroundColor: "rgba(0, 122, 255, 0.05)",
                    fontWeight: 500,
                    fontSize: "12px",
                    py: 0.3,
                    px: 1.5,
                    borderRadius: 1.5,
                    textTransform: "none",
                    "&:hover": {
                      backgroundColor: "rgba(0, 122, 255, 0.1)",
                      borderColor: "#0056CC",
                    },
                    "&:disabled": {
                      color: "rgba(0, 122, 255, 0.5)",
                      borderColor: "rgba(0, 122, 255, 0.3)",
                    },
                    transition: "all 0.2s ease-in-out",
                  }}
                >
                  {loadingProvinces ? (
                    <>
                      <CircularProgress
                        size={14}
                        sx={{ mr: 0.5, color: "#007AFF" }}
                      />
                      {retryCount > 0
                        ? `Retrying... (${retryCount}/${maxRetries})`
                        : "Getting Provinces..."}
                    </>
                  ) : (
                    "Get Provinces"
                  )}
                </Button>
              </Box>

              <TextField
                label="Address"
                name="buyerAddress"
                value={formData.buyerAddress}
                onChange={handleChange}
                fullWidth
                required
                variant="outlined"
                multiline
                rows={2}
                size="small"
                sx={{
                  "& .MuiOutlinedInput-root": {
                    backgroundColor: "rgba(255, 255, 255, 0.6)",
                    backdropFilter: "blur(10px)",
                    borderRadius: 2,
                    "& fieldset": {
                      borderColor: "rgba(0, 0, 0, 0.12)",
                    },
                    "&:hover fieldset": {
                      borderColor: "rgba(0, 0, 0, 0.2)",
                    },
                    "&.Mui-focused fieldset": {
                      borderColor: "#007AFF",
                      borderWidth: 2,
                    },
                  },
                  "& .MuiInputLabel-root": {
                    color: "#1a1a1a",
                    fontWeight: 500,
                  },
                  "& .MuiOutlinedInput-input": {
                    color: "#1a1a1a",
                  },
                }}
              />

              <FormControl
                fullWidth
                required
                size="small"
                sx={{
                  "& .MuiOutlinedInput-root": {
                    backgroundColor: "rgba(255, 255, 255, 0.6)",
                    backdropFilter: "blur(10px)",
                    borderRadius: 2,
                    "& fieldset": {
                      borderColor: "rgba(0, 0, 0, 0.12)",
                    },
                    "&:hover fieldset": {
                      borderColor: "rgba(0, 0, 0, 0.2)",
                    },
                    "&.Mui-focused fieldset": {
                      borderColor: "#007AFF",
                      borderWidth: 2,
                    },
                  },
                  "& .MuiInputLabel-root": {
                    color: "#1a1a1a",
                    fontWeight: 500,
                  },
                  "& .MuiSelect-select": {
                    color: "#1a1a1a",
                  },
                }}
              >
                <InputLabel id="buyerRegistrationType-label">
                  Registration Type
                </InputLabel>
                <Select
                  labelId="buyerRegistrationType-label"
                  name="buyerRegistrationType"
                  value={formData.buyerRegistrationType}
                  label="Registration Type"
                  onChange={handleChange}
                  disabled={checkingBuyerRegistration || registrationTypeLocked}
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        backgroundColor: "rgba(255, 255, 255, 0.9)",
                        backdropFilter: "blur(20px)",
                        border: "1px solid rgba(255, 255, 255, 0.3)",
                        borderRadius: 2,
                        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
                      },
                    },
                  }}
                >
                  <MenuItem
                    value="Registered"
                    sx={{
                      color: "#1a1a1a",
                      "&:hover": {
                        backgroundColor: "rgba(0, 122, 255, 0.1)",
                      },
                    }}
                  >
                    Registered
                  </MenuItem>
                  <MenuItem
                    value="Unregistered"
                    sx={{
                      color: "#1a1a1a",
                      "&:hover": {
                        backgroundColor: "rgba(0, 122, 255, 0.1)",
                      },
                    }}
                  >
                    Unregistered
                  </MenuItem>
                </Select>
              </FormControl>

              {/* Action buttons with modern styling */}
              <Stack spacing={1} sx={{ mt: { xs: 1, sm: 1.5 } }}>
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  disabled={isSubmitting}
                  size="small"
                  sx={{
                    backgroundColor: "#007AFF",
                    color: "white",
                    fontWeight: 600,
                    fontSize: { xs: "13px", sm: "14px" },
                    py: { xs: 0.8, sm: 1 },
                    borderRadius: 2,
                    textTransform: "none",
                    boxShadow: "0 4px 20px rgba(0, 122, 255, 0.3)",
                    "&:hover": {
                      backgroundColor: "#0056CC",
                      transform: "translateY(-1px)",
                      boxShadow: "0 6px 25px rgba(0, 122, 255, 0.4)",
                    },
                    "&:disabled": {
                      backgroundColor: "rgba(0, 122, 255, 0.6)",
                    },
                    transition: "all 0.2s ease-in-out",
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <CircularProgress
                        size={18}
                        sx={{ mr: 1, color: "white" }}
                      />
                      Saving...
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>

                <Button
                  type="button"
                  onClick={onClose}
                  variant="outlined"
                  fullWidth
                  size="small"
                  sx={{
                    color: "#666",
                    borderColor: "rgba(0, 0, 0, 0.12)",
                    backgroundColor: "rgba(255, 255, 255, 0.4)",
                    backdropFilter: "blur(10px)",
                    fontWeight: 500,
                    fontSize: { xs: "13px", sm: "14px" },
                    py: { xs: 0.8, sm: 1 },
                    borderRadius: 2,
                    textTransform: "none",
                    "&:hover": {
                      backgroundColor: "rgba(255, 255, 255, 0.6)",
                      borderColor: "rgba(0, 0, 0, 0.2)",
                      transform: "translateY(-1px)",
                    },
                    transition: "all 0.2s ease-in-out",
                  }}
                >
                  Cancel
                </Button>
              </Stack>
            </Stack>
          </Box>
        </Paper>
      </Box>
    </>
  );
};

export default BuyerModal;
