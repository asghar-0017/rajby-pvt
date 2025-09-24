import React, { useState, useEffect } from "react";
import { useAuth } from "../Context/AuthProvider";
import { api } from "../API/Api";
import Swal from "sweetalert2";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Fab,
  Tabs,
  Tab,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Visibility as ViewIcon,
} from "@mui/icons-material";
import CreateUserModal from "../component/CreateUserModal";
import RoleManagementTab from "../component/RoleManagementTab";
import PermissionGate from "../component/PermissionGate";

const UserManagement = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [assignmentDialog, setAssignmentDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchTenants();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get("/user-management/users");

      if (response.data.success) {
        setUsers(response.data.data);
      } else {
        setError("Failed to fetch users");
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      setError(error.response?.data?.message || "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const fetchTenants = async () => {
    try {
      const response = await api.get("/user-management/tenants");

      if (response.data.success) {
        setTenants(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching tenants:", error);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setIsEditMode(false);
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (user) => {
    setEditingUser(user);
    setIsEditMode(true);
    setIsCreateModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsCreateModalOpen(false);
    setEditingUser(null);
    setIsEditMode(false);
  };

  const handleAssignTenant = async (tenantId) => {
    try {
      const response = await api.post("/user-management/users/assign-tenant", {
        userId: selectedUser.id,
        tenantId,
      });

      if (response.data.success) {
        Swal.fire(
          "Success!",
          "User assigned to company successfully.",
          "success"
        );
        setAssignmentDialog(false);
        fetchUsers();
      } else {
        Swal.fire("Error!", response.data.message, "error");
      }
    } catch (error) {
      console.error("Error assigning tenant:", error);
      Swal.fire("Error!", "Failed to assign user to company", "error");
    }
  };

  const handleCloseAssignmentDialog = () => {
    setAssignmentDialog(false);
    setSelectedUser(null);
  };

  const openAssignmentDialog = (user) => {
    setSelectedUser(user);
    setAssignmentDialog(true);
  };

  // Handle create/edit user from modal
  const handleSaveUser = async (userData) => {
    console.log('User data received:', userData);
    try {
      if (isEditMode) {
        // Update existing user
        const payload = {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          phone: userData.phoneNumber,
          roleId: userData.roleId,
          status: userData.status,
          tenantIds: userData.assignedCompanies,
        };

        // Only include password if it was provided
        if (userData.password) {
          payload.password = userData.password;
        }

        const response = await api.put(
          `/user-management/users/${editingUser.id}`,
          payload
        );

        if (response.data.success) {
          Swal.fire({
            icon: "success",
            title: "User Updated",
            text: response.data.message,
          });
          handleCloseModal();
          fetchUsers();
        } else {
          Swal.fire({
            icon: "error",
            title: "Error",
            text: response.data.message,
          });
        }
      } else {
        // Create new user
        const payload = {
          email: userData.email,
          password: userData.password,
          firstName: userData.firstName,
          lastName: userData.lastName,
          phone: userData.phoneNumber,
          roleId: userData.roleId,
          status: userData.status,
          tenantIds: userData.assignedCompanies,
        };

        const response = await api.post("/user-management/users", payload);

        if (response.data.success) {
          Swal.fire({
            icon: "success",
            title: "User Created",
            text: response.data.message,
          });
          handleCloseModal();
          fetchUsers();
        } else {
          Swal.fire({
            icon: "error",
            title: "Error",
            text: response.data.message,
          });
        }
      }
    } catch (error) {
      console.error("Error saving user:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.response?.data?.message || "Failed to save user",
      });
      throw error; // Re-throw to let the modal handle the error state
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      const result = await Swal.fire({
        title: "Are you sure?",
        text: "You won't be able to revert this!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Yes, delete it!",
      });

      if (result.isConfirmed) {
        const response = await api.delete(`/user-management/users/${userId}`);

        if (response.data.success) {
          Swal.fire("Deleted!", "User has been deleted.", "success");
          fetchUsers();
        } else {
          Swal.fire("Error!", response.data.message, "error");
        }
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      Swal.fire("Error!", "Failed to delete user", "error");
    }
  };

  // Get current user's company access (for demo purposes, you should implement this based on your auth system)
  const getCurrentUserAccess = () => {
    // For now, return all tenant IDs - you should implement proper access control
    // based on the current user's permissions
    return tenants.map((tenant) => tenant.id);
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ padding: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          User Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage system users, roles, and permissions
        </Typography>
      </Box>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={(e, newValue) => setTabValue(newValue)}
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab label="Users" />
          <Tab label="Roles" />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      {tabValue === 0 && (
        <Box>
          {/* Action Bar */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="h6">Users ({users.length})</Typography>
                <Typography variant="body2" color="text.secondary">
                  Total registered users in the system
                </Typography>
              </Box>
              <PermissionGate permission="create_user">
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleOpenCreateModal}
                  sx={{ minWidth: 150 }}
                >
                  Create User
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

          {/* Users Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell>Contact</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Companies</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <Box display="flex" alignItems="center" gap={1}>
                    <PersonIcon color="primary" />
                    <Box>
                      <Typography variant="subtitle2">
                        {user.firstName} {user.lastName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        ID: {user.id}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>
                  <Box>
                    <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                      <EmailIcon fontSize="small" color="action" />
                      <Typography variant="body2">{user.email}</Typography>
                    </Box>
                    {user.phone && (
                      <Box display="flex" alignItems="center" gap={1}>
                        <PhoneIcon fontSize="small" color="action" />
                        <Typography variant="body2">{user.phone}</Typography>
                      </Box>
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip
                    label={user.userRole?.name || user.role || "No Role"}
                    color={
                      user.userRole?.name === "admin" || user.role === "admin" 
                        ? "error" 
                        : user.userRole?.name || user.role 
                          ? "primary" 
                          : "default"
                    }
                    size="small"
                    variant={user.userRole?.name || user.role ? "filled" : "outlined"}
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={user.isActive ? "Active" : "Blocked"}
                    color={user.isActive ? "success" : "error"}
                    size="small"
                    variant="filled"
                  />
                </TableCell>
                <TableCell>
                  <Box display="flex" flexWrap="wrap" gap={0.5}>
                    {user.UserTenantAssignments?.map((assignment) => {
                      // The backend returns nested Tenant data, so we need to access assignment.Tenant.id
                      const tenantId = assignment.Tenant?.id || assignment.tenantId;
                      const tenant = tenants.find((t) => t.id === tenantId);
                      
                      // Use the tenant name from the assignment if available, otherwise find it in tenants array
                      const companyName = assignment.Tenant?.seller_business_name || 
                                        tenant?.seller_business_name || 
                                        tenantId;
                      
                      return (
                        <Chip
                          key={tenantId}
                          label={companyName}
                          size="small"
                          variant="outlined"
                        />
                      );
                    }) || (
                      <Typography variant="caption" color="text.secondary">
                        No companies assigned
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box display="flex" gap={1}>
                    <PermissionGate permission="update_user">
                      <Tooltip title="Edit User">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenEditModal(user)}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                    </PermissionGate>
                    <PermissionGate permission="delete_user">
                      <Tooltip title="Delete User">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteUser(user.id)}
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
        </Box>
      )}

      {tabValue === 1 && (
        <RoleManagementTab />
      )}

      {/* Assignment Dialog */}
      <Dialog
        open={assignmentDialog}
        onClose={handleCloseAssignmentDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Assign Company to {selectedUser?.firstName} {selectedUser?.lastName}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select a company to assign to this user:
          </Typography>
          <Grid container spacing={2}>
            {tenants.map((tenant) => (
              <Grid item xs={12} key={tenant.id}>
                <Card
                  sx={{
                    cursor: "pointer",
                    "&:hover": { backgroundColor: "action.hover" },
                  }}
                  onClick={() => handleAssignTenant(tenant.id)}
                >
                  <CardContent>
                    <Box display="flex" alignItems="center">
                      <BusinessIcon sx={{ mr: 1, color: "primary.main" }} />
                      <Box>
                        <Typography variant="h6">
                          {tenant.seller_business_name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          NTN: {tenant.seller_ntn_cnic}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAssignmentDialog}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Create/Edit User Modal */}
      <CreateUserModal
        isOpen={isCreateModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveUser}
        companies={tenants}
        currentUserAccess={getCurrentUserAccess()}
        editingUser={editingUser}
        isEditMode={isEditMode}
      />
    </Box>
  );
};

export default UserManagement;