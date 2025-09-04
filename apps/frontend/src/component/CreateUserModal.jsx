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
  FormControlLabel,
  Radio,
  RadioGroup,
  Chip,
  OutlinedInput,
  Checkbox,
  ListItemText,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import EditIcon from "@mui/icons-material/Edit";
import { useTenantSelection } from "../Context/TenantSelectionProvider";

const CreateUserModal = ({
  isOpen,
  onClose,
  onSave,
  companies = [],
  currentUserAccess = [],
  editingUser = null, // Add editingUser prop
  isEditMode = false, // Add isEditMode prop
}) => {
  const { tokensLoaded, validateAndRefreshToken } = useTenantSelection();

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
    role: "user",
    assignedCompanies: [],
    status: "active",
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Filter companies based on current user's access
  const accessibleCompanies =
    currentUserAccess.length > 0
      ? companies.filter((company) => currentUserAccess.includes(company.id))
      : companies;

  // Helper function to get company name from different data structures
  const getCompanyName = (company) => {
    // Handle both tenant structure (sellerBusinessName) and company structure (name)
    return (
      company.sellerBusinessName ||
      company.name ||
      company.seller_business_name ||
      "Unknown Company"
    );
  };

  // Helper function to get company ID from different data structures
  const getCompanyId = (company) => {
    return company.id || company.tenant_id;
  };

  // Reset form when modal opens or editingUser changes
  useEffect(() => {
    if (isOpen) {
      if (editingUser && isEditMode) {
        // Pre-fill form with existing user data
        setFormData({
          firstName: editingUser.firstName || "",
          lastName: editingUser.lastName || "",
          email: editingUser.email || "",
          phoneNumber: editingUser.phone || editingUser.phoneNumber || "",
          password: "", // Don't pre-fill password for security
          confirmPassword: "",
          role: editingUser.role || "user",
          assignedCompanies:
            editingUser.UserTenantAssignments?.map(
              (assignment) => assignment.tenantId || assignment.Tenant?.id
            ).filter(Boolean) || [],
          status: "active", // Always set to active for editing
        });
      } else {
        // Reset form for new user
        setFormData({
          firstName: "",
          lastName: "",
          email: "",
          phoneNumber: "",
          password: "",
          confirmPassword: "",
          role: "user",
          assignedCompanies: [],
          status: "active",
        });
      }
      setErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen, editingUser, isEditMode]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = "Phone number is required";
    } else if (
      !/^[\+]?[1-9][\d]{0,15}$/.test(formData.phoneNumber.replace(/\s/g, ""))
    ) {
      newErrors.phoneNumber = "Please enter a valid phone number";
    }

    // Only require password for new users
    if (!isEditMode && !formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password && formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters long";
    }

    // Only require confirm password if password is provided
    if (formData.password && formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (formData.assignedCompanies.length === 0) {
      newErrors.assignedCompanies = "At least one company must be assigned";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare data for submission
      const submitData = {
        ...formData,
        confirmPassword: undefined,
      };

      // Remove password if it's empty (for editing)
      if (isEditMode && !submitData.password) {
        delete submitData.password;
      }

      await onSave(submitData);
      onClose();
    } catch (error) {
      console.error("Error saving user:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleCompanyChange = (event) => {
    const value = event.target.value;
    setFormData((prev) => ({ ...prev, assignedCompanies: value }));

    if (errors.assignedCompanies) {
      setErrors((prev) => ({ ...prev, assignedCompanies: "" }));
    }
  };

  if (!isOpen) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1300,
        padding: 2,
      }}
      onClick={onClose}
    >
      <Paper
        sx={{
          width: "100%",
          maxWidth: 600,
          maxHeight: "90vh",
          overflow: "auto",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <Box
          sx={{
            backgroundColor: "primary.main",
            color: "white",
            padding: 2,
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          {isEditMode ? <EditIcon /> : <PersonAddIcon />}
          <Typography variant="h6" component="h2">
            {isEditMode ? "Edit User" : "Create New User"}
          </Typography>
          <IconButton
            onClick={onClose}
            sx={{ marginLeft: "auto", color: "white" }}
            size="small"
          >
            <CloseIcon />
          </IconButton>
        </Box>

        <Box component="form" onSubmit={handleSubmit} sx={{ padding: 3 }}>
          <Stack spacing={3}>
            {/* Personal Information */}
            <Box>
              <Typography variant="h6" sx={{ mb: 2, color: "text.secondary" }}>
                Personal Information
              </Typography>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="First Name *"
                  value={formData.firstName}
                  onChange={(e) =>
                    handleInputChange("firstName", e.target.value)
                  }
                  fullWidth
                  error={!!errors.firstName}
                  helperText={errors.firstName}
                  required
                />
                <TextField
                  label="Last Name *"
                  value={formData.lastName}
                  onChange={(e) =>
                    handleInputChange("lastName", e.target.value)
                  }
                  fullWidth
                  error={!!errors.lastName}
                  helperText={errors.lastName}
                  required
                />
              </Stack>
            </Box>

            {/* Contact Information */}
            <Box>
              <Typography variant="h6" sx={{ mb: 2, color: "text.secondary" }}>
                Contact Information
              </Typography>
              <Stack spacing={2}>
                <TextField
                  label="Email Address *"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  fullWidth
                  error={!!errors.email}
                  helperText={errors.email}
                  required
                />
                <TextField
                  label="Phone Number *"
                  value={formData.phoneNumber}
                  onChange={(e) =>
                    handleInputChange("phoneNumber", e.target.value)
                  }
                  fullWidth
                  error={!!errors.phoneNumber}
                  helperText={errors.phoneNumber}
                  required
                />
              </Stack>
            </Box>

            {/* Security */}
            <Box>
              <Typography variant="h6" sx={{ mb: 2, color: "text.secondary" }}>
                Security
              </Typography>
              <Stack spacing={2}>
                <TextField
                  label={
                    isEditMode
                      ? "New Password (leave blank to keep current)"
                      : "Password *"
                  }
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) =>
                    handleInputChange("password", e.target.value)
                  }
                  fullWidth
                  error={!!errors.password}
                  helperText={errors.password}
                  required={!isEditMode}
                />
                {formData.password && (
                  <TextField
                    label="Confirm Password *"
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      handleInputChange("confirmPassword", e.target.value)
                    }
                    fullWidth
                    error={!!errors.confirmPassword}
                    helperText={errors.confirmPassword}
                    required
                  />
                )}
              </Stack>
            </Box>

            {/* Role and Status */}
            <Box>
              <Typography variant="h6" sx={{ mb: 2, color: "text.secondary" }}>
                Role & Status
              </Typography>
              <Stack direction="row" spacing={2}>
                <FormControl fullWidth>
                  <InputLabel>Role</InputLabel>
                  <Select
                    value={formData.role}
                    onChange={(e) => handleInputChange("role", e.target.value)}
                    label="Role"
                  >
                    <MenuItem value="user">User</MenuItem>
                    <MenuItem value="admin">Admin</MenuItem>
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={formData.status}
                    onChange={(e) =>
                      handleInputChange("status", e.target.value)
                    }
                    label="Status"
                  >
                    <MenuItem value="active">Active</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </Box>

            {/* Company Assignment */}
            <Box>
              <Typography variant="h6" sx={{ mb: 2, color: "text.secondary" }}>
                Company Assignment
              </Typography>
              {currentUserAccess.length > 0 && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  You can only assign users to companies you have access to:{" "}
                  {accessibleCompanies.map((c) => getCompanyName(c)).join(", ")}
                </Alert>
              )}
              <FormControl fullWidth error={!!errors.assignedCompanies}>
                <InputLabel>Assigned Companies *</InputLabel>
                <Select
                  multiple
                  value={formData.assignedCompanies}
                  onChange={handleCompanyChange}
                  input={<OutlinedInput label="Assigned Companies *" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                      {selected.map((value) => {
                        const company = accessibleCompanies.find(
                          (c) => getCompanyId(c) === value
                        );
                        return (
                          <Chip
                            key={value}
                            label={company ? getCompanyName(company) : value}
                            size="small"
                          />
                        );
                      })}
                    </Box>
                  )}
                >
                  {accessibleCompanies.map((company) => (
                    <MenuItem
                      key={getCompanyId(company)}
                      value={getCompanyId(company)}
                    >
                      <Checkbox
                        checked={
                          formData.assignedCompanies.indexOf(
                            getCompanyId(company)
                          ) > -1
                        }
                      />
                      <ListItemText primary={getCompanyName(company)} />
                    </MenuItem>
                  ))}
                </Select>
                {errors.assignedCompanies && (
                  <Typography variant="caption" color="error">
                    {errors.assignedCompanies}
                  </Typography>
                )}
              </FormControl>
            </Box>
          </Stack>

          <Divider sx={{ my: 3 }} />

          {/* Action Buttons */}
          <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
            <Button
              variant="outlined"
              onClick={onClose}
              disabled={isSubmitting}
              sx={{ minWidth: 100 }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              type="submit"
              disabled={isSubmitting}
              sx={{ minWidth: 120 }}
              startIcon={isSubmitting ? <CircularProgress size={20} /> : null}
            >
              {isSubmitting
                ? isEditMode
                  ? "Updating..."
                  : "Creating..."
                : isEditMode
                  ? "Update User"
                  : "Create User"}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default CreateUserModal;
