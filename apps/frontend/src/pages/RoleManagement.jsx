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
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Grid,
  Alert,
  Snackbar,
  CircularProgress,
  Tooltip,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Security as SecurityIcon,
  Visibility as VisibilityIcon,
} from "@mui/icons-material";
import { useTenantSelection } from "../Context/TenantSelectionProvider";

const RoleManagement = () => {
  const { tokensLoaded, validateAndRefreshToken, getCurrentToken } = useTenantSelection();
  
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [groupedPermissions, setGroupedPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    permissions: [],
  });

  const [errors, setErrors] = useState({});

  // Fetch roles and permissions
  const fetchData = async () => {
    try {
      setLoading(true);
      // Use admin token instead of tenant token for role management
      const adminToken = localStorage.getItem("token");
      
      if (!adminToken) {
        console.error("No admin authentication token available");
        setLoading(false);
        return;
      }
      
      const [rolesResponse, permissionsResponse, groupedResponse] = await Promise.all([
        fetch("/api/role-management/roles", {
          headers: { Authorization: `Bearer ${adminToken}` },
        }),
        fetch("/api/role-management/permissions", {
          headers: { Authorization: `Bearer ${adminToken}` },
        }),
        fetch("/api/role-management/permissions/grouped", {
          headers: { Authorization: `Bearer ${adminToken}` },
        }),
      ]);

      const [rolesData, permissionsData, groupedData] = await Promise.all([
        rolesResponse.json(),
        permissionsResponse.json(),
        groupedResponse.json(),
      ]);

      if (rolesData.success) setRoles(rolesData.data);
      if (permissionsData.success) setPermissions(permissionsData.data);
      if (groupedData.success) setGroupedPermissions(groupedData.data);
    } catch (error) {
      console.error("Error fetching data:", error);
      showSnackbar("Failed to fetch data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check if admin is logged in
    const adminToken = localStorage.getItem("token");
    const user = localStorage.getItem("user");
    
    if (adminToken && user) {
      try {
        const userData = JSON.parse(user);
        if (userData.role === "admin") {
          fetchData();
        } else {
          console.log("User is not an admin, cannot access role management");
          setLoading(false);
        }
      } catch (error) {
        console.error("Error parsing user data:", error);
        setLoading(false);
      }
    } else {
      console.log("No admin authentication found");
      setLoading(false);
    }
  }, []);

  const showSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ open: false, message: "", severity: "success" });
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      permissions: [],
    });
    setErrors({});
  };

  const handleCreateRole = () => {
    resetForm();
    setIsCreateModalOpen(true);
  };

  const handleEditRole = (role) => {
    setFormData({
      name: role.name,
      description: role.description || "",
      permissions: role.permissions.map(p => p.id),
    });
    setEditingRole(role);
    setIsEditModalOpen(true);
  };

  const handleDeleteRole = async (role) => {
    if (role.isSystemRole) {
      showSnackbar("Cannot delete system roles", "error");
      return;
    }

    if (window.confirm(`Are you sure you want to delete the role "${role.name}"?`)) {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(`/api/role-management/roles/${role.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await response.json();
        if (data.success) {
          showSnackbar("Role deleted successfully");
          fetchData();
        } else {
          showSnackbar(data.message, "error");
        }
      } catch (error) {
        console.error("Error deleting role:", error);
        showSnackbar("Failed to delete role", "error");
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = "Role name is required";
    }
    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) return;

    try {
      const token = localStorage.getItem("token");
      const url = isEditModalOpen 
        ? `/api/role-management/roles/${editingRole.id}`
        : "/api/role-management/roles";
      
      const method = isEditModalOpen ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (data.success) {
        showSnackbar(
          isEditModalOpen ? "Role updated successfully" : "Role created successfully"
        );
        setIsCreateModalOpen(false);
        setIsEditModalOpen(false);
        resetForm();
        fetchData();
      } else {
        showSnackbar(data.message, "error");
      }
    } catch (error) {
      console.error("Error saving role:", error);
      showSnackbar("Failed to save role", "error");
    }
  };

  const handlePermissionChange = (permissionId, checked) => {
    setFormData(prev => ({
      ...prev,
      permissions: checked
        ? [...prev.permissions, permissionId]
        : prev.permissions.filter(id => id !== permissionId)
    }));
  };

  const handleResourcePermissionChange = (resource, checked) => {
    const resourcePermissions = groupedPermissions[resource] || [];
    const permissionIds = resourcePermissions.map(p => p.id);
    
    setFormData(prev => ({
      ...prev,
      permissions: checked
        ? [...new Set([...prev.permissions, ...permissionIds])]
        : prev.permissions.filter(id => !permissionIds.includes(id))
    }));
  };

  const isResourceFullySelected = (resource) => {
    const resourcePermissions = groupedPermissions[resource] || [];
    return resourcePermissions.every(p => formData.permissions.includes(p.id));
  };

  const isResourcePartiallySelected = (resource) => {
    const resourcePermissions = groupedPermissions[resource] || [];
    const selectedCount = resourcePermissions.filter(p => formData.permissions.includes(p.id)).length;
    return selectedCount > 0 && selectedCount < resourcePermissions.length;
  };

  const getPermissionChips = (role) => {
    if (!role.permissions || role.permissions.length === 0) {
      return <Chip label="No permissions" size="small" color="default" />;
    }

    const grouped = role.permissions.reduce((acc, permission) => {
      if (!acc[permission.resource]) {
        acc[permission.resource] = [];
      }
      acc[permission.resource].push(permission.action);
      return acc;
    }, {});

    return Object.entries(grouped).map(([resource, actions]) => (
      <Chip
        key={resource}
        label={`${resource}: ${actions.join(", ")}`}
        size="small"
        color="primary"
        sx={{ mr: 0.5, mb: 0.5 }}
      />
    ));
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <SecurityIcon color="primary" />
          <Typography variant="h4" component="h1">
            Role Management
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateRole}
        >
          Create Role
        </Button>
      </Box>

      <Paper sx={{ p: 2 }}>
        <TableContainer>
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
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      {role.name}
                      {role.isSystemRole && (
                        <Chip label="System" size="small" color="secondary" />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>{role.description || "No description"}</TableCell>
                  <TableCell>
                    <Chip
                      label={role.isSystemRole ? "System Role" : "Custom Role"}
                      size="small"
                      color={role.isSystemRole ? "secondary" : "primary"}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                      {getPermissionChips(role)}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", gap: 1 }}>
                      <Tooltip title="Edit Role">
                        <IconButton
                          size="small"
                          onClick={() => handleEditRole(role)}
                          disabled={role.isSystemRole}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete Role">
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteRole(role)}
                          disabled={role.isSystemRole}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Create/Edit Role Modal */}
      <Dialog
        open={isCreateModalOpen || isEditModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setIsEditModalOpen(false);
          resetForm();
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {isEditModalOpen ? "Edit Role" : "Create New Role"}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Role Name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  error={!!errors.name}
                  helperText={errors.name}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  multiline
                  rows={2}
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Permissions
                </Typography>
                {Object.entries(groupedPermissions).map(([resource, resourcePermissions]) => (
                  <Box key={resource} sx={{ mb: 2 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={isResourceFullySelected(resource)}
                          indeterminate={isResourcePartiallySelected(resource)}
                          onChange={(e) => handleResourcePermissionChange(resource, e.target.checked)}
                        />
                      }
                      label={
                        <Typography variant="subtitle1" sx={{ textTransform: "capitalize" }}>
                          {resource} ({resourcePermissions.length} permissions)
                        </Typography>
                      }
                    />
                    <Box sx={{ ml: 4 }}>
                      {resourcePermissions.map((permission) => {
                        // Conditional permission logic
                        const shouldHidePermission = () => {
                          // If user has uploader permission, hide download template permission
                          if (permission.name === 'invoice.template' || permission.name === 'Download Invoice Template') {
                            const hasUploaderPermission = formData.permissions.some(permId => {
                              const perm = resourcePermissions.find(p => p.id === permId);
                              return perm && (perm.name === 'invoice.uploader' || perm.name === 'Invoice Uploader');
                            });
                            return hasUploaderPermission;
                          }
                          
                          // If user has validate permission, hide save permission
                          if (permission.name === 'invoice_save' || permission.name === 'Invoice Save') {
                            const hasValidatePermission = formData.permissions.some(permId => {
                              const perm = resourcePermissions.find(p => p.id === permId);
                              return perm && (perm.name === 'invoice_validate' || perm.name === 'Invoice Validate');
                            });
                            return hasValidatePermission;
                          }
                          
                          // If user has report permission, hide product.view, buyer.view, and invoice.view permissions
                          if (permission.name === 'product.view' || permission.name === 'View Products') {
                            const hasReportPermission = formData.permissions.some(permId => {
                              // Check across all categories for report permission
                              return Object.values(groupedPermissions).some(categoryPermissions => 
                                categoryPermissions.some(p => p.id === permId && 
                                  (p.name === 'report.view' || p.name === 'View Reports')
                                )
                              );
                            });
                            return hasReportPermission;
                          }
                          
                          if (permission.name === 'buyer.view' || permission.name === 'View Buyers') {
                            const hasReportPermission = formData.permissions.some(permId => {
                              // Check across all categories for report permission
                              return Object.values(groupedPermissions).some(categoryPermissions => 
                                categoryPermissions.some(p => p.id === permId && 
                                  (p.name === 'report.view' || p.name === 'View Reports')
                                )
                              );
                            });
                            return hasReportPermission;
                          }
                          
                          if (permission.name === 'invoice.view' || permission.name === 'View Invoices') {
                            const hasReportPermission = formData.permissions.some(permId => {
                              // Check across all categories for report permission
                              return Object.values(groupedPermissions).some(categoryPermissions => 
                                categoryPermissions.some(p => p.id === permId && 
                                  (p.name === 'report.view' || p.name === 'View Reports')
                                )
                              );
                            });
                            return hasReportPermission;
                          }
                          
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
                                checked={formData.permissions.includes(permission.id)}
                                onChange={(e) => handlePermissionChange(permission.id, e.target.checked)}
                              />
                            }
                            label={`${permission.action} ${permission.resource}`}
                          />
                        );
                      })}
                    </Box>
                  </Box>
                ))}
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setIsCreateModalOpen(false);
                setIsEditModalOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="contained">
              {isEditModalOpen ? "Update Role" : "Create Role"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default RoleManagement;