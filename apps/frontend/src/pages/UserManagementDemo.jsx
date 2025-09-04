import React, { useState } from "react";
import {
  Box,
  Button,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Stack,
  Alert,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CreateUserModal from "../component/CreateUserModal";

const UserManagementDemo = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Simulate current user's company access (in real app, this comes from your auth context)
  const currentUserAccess = ["company-a", "company-b"]; // Admin only has access to Company A and B

  const [users, setUsers] = useState([
    {
      id: 1,
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@example.com",
      phoneNumber: "+92-300-1234567",
      role: "admin",
      status: "active",
      assignedCompanies: ["Company A", "Company B"],
      createdAt: "2024-01-15",
    },
    {
      id: 2,
      firstName: "Jane",
      lastName: "Smith",
      email: "jane.smith@example.com",
      phoneNumber: "+92-301-9876543",
      role: "manager",
      status: "active",
      assignedCompanies: ["Company A"],
      createdAt: "2024-01-20",
    },
    {
      id: 3,
      firstName: "Ahmed",
      lastName: "Khan",
      email: "ahmed.khan@example.com",
      phoneNumber: "+92-302-5555555",
      role: "user",
      status: "pending",
      assignedCompanies: ["Company C"],
      createdAt: "2024-01-25",
    },
  ]);

  // Sample companies data
  const companies = [
    { id: "company-a", name: "Company A" },
    { id: "company-b", name: "Company B" },
    { id: "company-c", name: "Company C" },
    { id: "company-d", name: "Company D" },
  ];

  const handleCreateUser = async (userData) => {
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const newUser = {
        id: users.length + 1,
        ...userData,
        assignedCompanies: userData.assignedCompanies.map(
          (id) => companies.find((c) => c.id === id)?.name
        ),
        createdAt: new Date().toISOString().split("T")[0],
      };

      setUsers((prev) => [...prev, newUser]);

      // Show success message (in real app, use toast/notification)
      console.log("User created successfully:", newUser);
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return "success";
      case "inactive":
        return "error";
      case "pending":
        return "warning";
      default:
        return "default";
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case "admin":
        return "error";
      case "manager":
        return "warning";
      case "user":
        return "primary";
      case "viewer":
        return "info";
      default:
        return "default";
    }
  };

  return (
    <Box sx={{ padding: 3, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          User Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage system users, their roles, and company assignments
        </Typography>
      </Box>

      {/* Action Bar */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Box>
            <Typography variant="h6">Users ({users.length})</Typography>
            <Typography variant="body2" color="text.secondary">
              Total registered users in the system
            </Typography>
            <Typography
              variant="caption"
              color="info.main"
              sx={{ display: "block", mt: 0.5 }}
            >
              Current admin access:{" "}
              {companies
                .filter((c) => currentUserAccess.includes(c.id))
                .map((c) => c.name)
                .join(", ")}
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setIsCreateModalOpen(true)}
            sx={{ minWidth: 150 }}
          >
            Create User
          </Button>
        </Stack>
      </Paper>

      {/* Users Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: "grey.50" }}>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Assigned Companies</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id} hover>
                <TableCell>
                  <Typography variant="body1" fontWeight="medium">
                    {user.firstName} {user.lastName}
                  </Typography>
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.phoneNumber}</TableCell>
                <TableCell>
                  <Chip
                    label={user.role}
                    color={getRoleColor(user.role)}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={user.status}
                    color={getStatusColor(user.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap">
                    {user.assignedCompanies.map((company, index) => (
                      <Chip
                        key={index}
                        label={company}
                        size="small"
                        variant="outlined"
                        sx={{ mb: 0.5 }}
                      />
                    ))}
                  </Stack>
                </TableCell>
                <TableCell>{user.createdAt}</TableCell>
                <TableCell align="center">
                  <Stack direction="row" spacing={1} justifyContent="center">
                    <IconButton size="small" color="primary">
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Empty State */}
      {users.length === 0 && (
        <Paper sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No users found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Get started by creating your first user
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setIsCreateModalOpen(true)}
          >
            Create First User
          </Button>
        </Paper>
      )}

      {/* Create User Modal */}
      <CreateUserModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSave={handleCreateUser}
        companies={companies}
        currentUserAccess={currentUserAccess}
      />

      {/* Usage Instructions */}
      <Paper sx={{ p: 3, mt: 4, backgroundColor: "info.50" }}>
        <Typography variant="h6" gutterBottom>
          How to Use
        </Typography>
        <Typography variant="body2" paragraph>
          This demo showcases a professional user creation form with the
          following features:
        </Typography>
        <Box component="ul" sx={{ pl: 2 }}>
          <Typography component="li" variant="body2">
            <strong>Form Validation:</strong> Real-time validation with helpful
            error messages
          </Typography>
          <Typography component="li" variant="body2">
            <strong>Professional UI:</strong> Clean, organized layout with
            Material-UI components
          </Typography>
          <Typography component="li" variant="body2">
            <strong>Company Assignment:</strong> Multi-select dropdown for
            assigning users to companies
          </Typography>
          <Typography component="li" variant="body2">
            <strong>Role Management:</strong> Predefined roles with appropriate
            styling
          </Typography>
          <Typography component="li" variant="body2">
            <strong>Responsive Design:</strong> Works well on different screen
            sizes
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default UserManagementDemo;
