import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  Alert,
  Tooltip,
  Divider,
  Stack,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  Security as SecurityIcon,
  Person as PersonIcon,
} from "@mui/icons-material";
import { api } from "../API/Api";
import Swal from "sweetalert2";
import PermissionGate from "./PermissionGate";

const RoleManagementTab = () => {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [groupedPermissions, setGroupedPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    permissions: [],
  });
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [rolesResponse, permissionsResponse, groupedResponse] = await Promise.all([
        api.get("/role-management/roles"),
        api.get("/role-management/permissions"),
        api.get("/role-management/permissions/grouped"),
      ]);

      if (rolesResponse.data.success) {
        setRoles(rolesResponse.data.data);
      }

      if (permissionsResponse.data.success) {
        setPermissions(permissionsResponse.data.data);
      }

      if (groupedResponse.data.success) {
        setGroupedPermissions(groupedResponse.data.data);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setError("Failed to fetch roles and permissions");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = () => {
    setFormData({
      name: "",
      description: "",
      permissions: [],
    });
    setFormErrors({});
    setIsCreateDialogOpen(true);
  };

  const handleEditRole = (role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description || "",
      permissions: role.permissions?.map(p => p.id) || [],
    });
    setFormErrors({});
    setIsEditDialogOpen(true);
  };

  const handleCloseDialogs = () => {
    setIsCreateDialogOpen(false);
    setIsEditDialogOpen(false);
    setEditingRole(null);
    setFormData({
      name: "",
      description: "",
      permissions: [],
    });
    setFormErrors({});
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.name.trim()) {
      errors.name = "Role name is required";
    }

    if (formData.name.length > 100) {
      errors.name = "Role name must be less than 100 characters";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        permissions: formData.permissions,
      };

      if (isEditDialogOpen && editingRole) {
        // Update role
        const response = await api.put(`/role-management/roles/${editingRole.id}`, payload);
        
        if (response.data.success) {
          Swal.fire({
            icon: "success",
            title: "Role Updated",
            text: "Role has been updated successfully",
          });
          handleCloseDialogs();
          fetchData();
        } else {
          Swal.fire({
            icon: "error",
            title: "Error",
            text: response.data.message,
          });
        }
      } else {
        // Create role
        const response = await api.post("/role-management/roles", payload);
        
        if (response.data.success) {
          Swal.fire({
            icon: "success",
            title: "Role Created",
            text: "Role has been created successfully",
          });
          handleCloseDialogs();
          fetchData();
        } else {
          Swal.fire({
            icon: "error",
            title: "Error",
            text: response.data.message,
          });
        }
      }
    } catch (error) {
      console.error("Error saving role:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.response?.data?.message || "Failed to save role",
      });
    }
  };

  const handleDeleteRole = async (role) => {
    try {
      const result = await Swal.fire({
        title: "Are you sure?",
        text: `You won't be able to revert this! This will delete the role "${role.name}".`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Yes, delete it!",
      });

      if (result.isConfirmed) {
        const response = await api.delete(`/role-management/roles/${role.id}`);

        if (response.data.success) {
          Swal.fire("Deleted!", "Role has been deleted.", "success");
          fetchData();
        } else {
          Swal.fire("Error!", response.data.message, "error");
        }
      }
    } catch (error) {
      console.error("Error deleting role:", error);
      Swal.fire("Error!", "Failed to delete role", "error");
    }
  };

  const handlePermissionChange = (permissionId, checked) => {
    setFormData(prev => {
      let newPermissions = checked
        ? [...prev.permissions, permissionId]
        : prev.permissions.filter(id => id !== permissionId);

      // If Report Management is being selected, automatically add Product View and Buyer View
      if (checked) {
        const permission = Object.values(groupedPermissions)
          .flat()
          .find(p => p.id === permissionId);
        
        if (permission && (permission.name === 'invoice.create' || permission.name === 'Create Invoice')) {
          // Find only Product View permission
          const productViewPermission = Object.values(groupedPermissions)
            .flat()
            .find(p => p.name === 'product.view' || p.name === 'Read Product');
          
          // Find Invoice View permission (Invoice List)
          const invoiceViewPermission = Object.values(groupedPermissions)
            .flat()
            .find(p => p.name === 'invoice.view' || p.name === 'Read Invoice');
          
          // Find only Buyer View permission
          const buyerViewPermission = Object.values(groupedPermissions)
            .flat()
            .find(p => p.name === 'buyer.view' || p.name === 'Read Buyer');
          
          // Add Product View permission
          if (productViewPermission && !newPermissions.includes(productViewPermission.id)) {
            newPermissions.push(productViewPermission.id);
          }
          
          // Add Invoice View permission
          if (invoiceViewPermission && !newPermissions.includes(invoiceViewPermission.id)) {
            newPermissions.push(invoiceViewPermission.id);
          }
          
          // Add Buyer View permission
          if (buyerViewPermission && !newPermissions.includes(buyerViewPermission.id)) {
            newPermissions.push(buyerViewPermission.id);
          }
        }
        
        if (permission && (permission.name === 'report.view' || permission.name === 'Report View')) {
          // Find Product View permission
          const productViewPermission = Object.values(groupedPermissions)
            .flat()
            .find(p => p.name === 'product.view' || p.name === 'Read Product');
          
          // Find Buyer View permission
          const buyerViewPermission = Object.values(groupedPermissions)
            .flat()
            .find(p => p.name === 'buyer.view' || p.name === 'Read Buyer');
          
          // Add Product View if not already selected
          if (productViewPermission && !newPermissions.includes(productViewPermission.id)) {
            newPermissions.push(productViewPermission.id);
          }
          
          // Add Buyer View if not already selected
          if (buyerViewPermission && !newPermissions.includes(buyerViewPermission.id)) {
            newPermissions.push(buyerViewPermission.id);
          }
        }
      }

      return {
        ...prev,
        permissions: newPermissions
      };
    });
  };

  const handleSelectAllPermissions = (category, checked) => {
    const categoryPermissions = groupedPermissions[category] || [];
    const permissionIds = categoryPermissions.map(p => p.id);
    
    setFormData(prev => {
      let newPermissions = checked
        ? [...new Set([...prev.permissions, ...permissionIds])]
        : prev.permissions.filter(id => !permissionIds.includes(id));

      // If Invoice Management category is being selected, automatically add view permissions for Product, Invoice List, and Buyer
      if (checked && category.toLowerCase().includes('invoice')) {
        // Find only Product View permission
        const productViewPermission = Object.values(groupedPermissions)
          .flat()
          .find(p => p.name === 'product.view' || p.name === 'Read Product');
        
        // Find Invoice View permission (Invoice List)
        const invoiceViewPermission = Object.values(groupedPermissions)
          .flat()
          .find(p => p.name === 'invoice.view' || p.name === 'Read Invoice');
        
        // Find only Buyer View permission
        const buyerViewPermission = Object.values(groupedPermissions)
          .flat()
          .find(p => p.name === 'buyer.view' || p.name === 'Read Buyer');
        
        // Add Product View permission
        if (productViewPermission && !newPermissions.includes(productViewPermission.id)) {
          newPermissions.push(productViewPermission.id);
        }
        
        // Add Invoice View permission
        if (invoiceViewPermission && !newPermissions.includes(invoiceViewPermission.id)) {
          newPermissions.push(invoiceViewPermission.id);
        }
        
        // Add Buyer View permission
        if (buyerViewPermission && !newPermissions.includes(buyerViewPermission.id)) {
          newPermissions.push(buyerViewPermission.id);
        }
      }
      
      // If Report Management category is being selected, automatically add Product View and Buyer View
      if (checked && category.toLowerCase().includes('report')) {
        // Find Product View permission
        const productViewPermission = Object.values(groupedPermissions)
          .flat()
          .find(p => p.name === 'product.view' || p.name === 'Read Product');
        
        // Find Buyer View permission
        const buyerViewPermission = Object.values(groupedPermissions)
          .flat()
          .find(p => p.name === 'buyer.view' || p.name === 'Read Buyer');
        
        // Add Product View if not already selected
        if (productViewPermission && !newPermissions.includes(productViewPermission.id)) {
          newPermissions.push(productViewPermission.id);
        }
        
        // Add Buyer View if not already selected
        if (buyerViewPermission && !newPermissions.includes(buyerViewPermission.id)) {
          newPermissions.push(buyerViewPermission.id);
        }
      }

      return {
        ...prev,
        permissions: newPermissions
      };
    });
  };

  const isAllPermissionsSelected = (category) => {
    const categoryPermissions = groupedPermissions[category] || [];
    return categoryPermissions.length > 0 && 
           categoryPermissions.every(p => formData.permissions.includes(p.id));
  };

  const isSomePermissionsSelected = (category) => {
    const categoryPermissions = groupedPermissions[category] || [];
    return categoryPermissions.some(p => formData.permissions.includes(p.id));
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6">Roles ({roles.length})</Typography>
            <Typography variant="body2" color="text.secondary">
              Manage user roles and their permissions
            </Typography>
          </Box>
          <PermissionGate permission="create_role">
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateRole}
              sx={{ minWidth: 150 }}
            >
              Create Role
            </Button>
          </PermissionGate>
        </Box>
      </Paper>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Roles Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Role Name</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Permissions</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {roles.map((role) => (
              <TableRow key={role.id}>
                <TableCell>
                  <Box display="flex" alignItems="center" gap={1}>
                    <SecurityIcon color="primary" />
                    <Typography variant="subtitle2" fontWeight="medium">
                      {role.name}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {role.description || "No description"}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={role.isSystemRole ? "System" : "Custom"}
                    color={role.isSystemRole ? "error" : "primary"}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <Box display="flex" flexWrap="wrap" gap={0.5}>
                    {role.permissions?.slice(0, 3).map((permission) => (
                      <Chip
                        key={permission.id}
                        label={permission.displayName || permission.name}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                    {role.permissions?.length > 3 && (
                      <Chip
                        label={`+${role.permissions.length - 3} more`}
                        size="small"
                        variant="outlined"
                        color="default"
                      />
                    )}
                    {(!role.permissions || role.permissions.length === 0) && (
                      <Typography variant="caption" color="text.secondary">
                        No permissions
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box display="flex" gap={1}>
                    <PermissionGate permission="update_role">
                      <Tooltip title="Edit Role">
                        <IconButton
                          size="small"
                          onClick={() => handleEditRole(role)}
                          disabled={role.isSystemRole}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                    </PermissionGate>
                    <PermissionGate permission="delete_role">
                      <Tooltip title="Delete Role">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteRole(role)}
                          disabled={role.isSystemRole}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </PermissionGate>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create/Edit Role Dialog */}
      <Dialog
        open={isCreateDialogOpen || isEditDialogOpen}
        onClose={handleCloseDialogs}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {isEditDialogOpen ? "Edit Role" : "Create New Role"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {/* Basic Information */}
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Basic Information
              </Typography>
              <Stack spacing={2}>
                <TextField
                  label="Role Name *"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  fullWidth
                  error={!!formErrors.name}
                  helperText={formErrors.name}
                />
                <TextField
                  label="Description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  fullWidth
                  multiline
                  rows={2}
                />
              </Stack>
            </Box>

            <Divider />

            {/* Permissions */}
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Permissions
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Select the permissions to assign to this role
              </Typography>
              
              {Object.keys(groupedPermissions).map((category) => (
                <Accordion key={category} defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={isAllPermissionsSelected(category)}
                            indeterminate={isSomePermissionsSelected(category) && !isAllPermissionsSelected(category)}
                            onChange={(e) => handleSelectAllPermissions(category, e.target.checked)}
                          />
                        }
                        label=""
                        sx={{ mr: 1 }}
                      />
                      <Typography variant="subtitle1" sx={{ textTransform: 'capitalize' }}>
                        {category}
                      </Typography>
                      <Chip
                        label={`${groupedPermissions[category]?.length || 0} permissions`}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <FormGroup>
                      {groupedPermissions[category]?.map((permission) => {
                        // Show all permissions in both create and edit modes
                        const isAssigned = formData.permissions.includes(permission.id);
                        
                        // Conditional permission logic
                        const shouldHidePermission = () => {
                          // If user has uploader permission, hide download template permission
                          if (permission.name === 'invoice.template' || permission.name === 'Download Invoice Template') {
                            const hasUploaderPermission = formData.permissions.some(permId => {
                              const perm = groupedPermissions[category]?.find(p => p.id === permId);
                              return perm && (perm.name === 'invoice.uploader' || perm.name === 'Invoice Uploader');
                            });
                            return hasUploaderPermission;
                          }
                          
                          // If user has validate permission, hide save permission
                          if (permission.name === 'invoice_save' || permission.name === 'Invoice Save') {
                            const hasValidatePermission = formData.permissions.some(permId => {
                              const perm = groupedPermissions[category]?.find(p => p.id === permId);
                              return perm && (perm.name === 'invoice_validate' || perm.name === 'Invoice Validate');
                            });
                            return hasValidatePermission;
                          }
                          
                          // Note: Product View and Buyer View are no longer hidden when Report Management is selected
                          // They are now automatically selected instead
                          
                          return false;
                        };
                        
                        // Hide permission if conditional logic applies
                        if (shouldHidePermission()) {
                          return null;
                        }
                        
                        return (
                          <FormControlLabel
                            key={permission.id}
                            control={
                              <Checkbox
                                checked={isAssigned}
                                onChange={(e) => handlePermissionChange(permission.id, e.target.checked)}
                              />
                            }
                            label={
                              <Box>
                                <Typography variant="body2" fontWeight="medium">
                                  {permission.displayName || permission.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {permission.description}
                                </Typography>
                              </Box>
                            }
                          />
                        );
                      })}
                    </FormGroup>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialogs}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!formData.name.trim()}
          >
            {isEditDialogOpen ? "Update Role" : "Create Role"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RoleManagementTab;
