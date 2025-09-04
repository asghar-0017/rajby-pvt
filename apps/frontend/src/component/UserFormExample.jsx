import React, { useState } from "react";
import {
  Box,
  Button,
  Typography,
  Paper,
  Stack,
  Alert,
  Divider,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CreateUserModal from "./CreateUserModal";

const UserFormExample = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lastCreatedUser, setLastCreatedUser] = useState(null);

  // Sample companies data
  const companies = [
    { id: "company-a", name: "Company A" },
    { id: "company-b", name: "Company B" },
    { id: "company-c", name: "Company C" },
  ];

  // Simulate current user's company access (in real app, this comes from your auth context)
  const currentUserAccess = ["company-a"]; // This user only has access to Company A

  const handleCreateUser = async (userData) => {
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Store the created user data
      setLastCreatedUser(userData);

      // In a real application, you would:
      // 1. Send the data to your backend API
      // 2. Handle success/error responses
      // 3. Update your application state
      // 4. Show success/error notifications

      console.log("User data to be sent to API:", userData);

      // Close the modal
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error creating user:", error);
      // In a real app, show error notification
      throw error;
    }
  };

  return (
    <Box sx={{ padding: 3, maxWidth: 800, margin: "0 auto" }}>
      {/* Header */}
      <Typography variant="h4" component="h1" gutterBottom>
        User Creation Form Example
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        This example demonstrates how to integrate the CreateUserModal component
        into your application.
      </Typography>

      {/* Action Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h6">Create New User</Typography>
          <Typography variant="body2" color="text.secondary">
            Click the button below to open the user creation form. The form
            includes validation, professional styling, and handles all user
            input fields.
          </Typography>
          <Alert severity="info">
            <strong>Access Control:</strong> You currently have access to:{" "}
            {companies
              .filter((c) => currentUserAccess.includes(c.id))
              .map((c) => c.name)
              .join(", ")}
          </Alert>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setIsModalOpen(true)}
            sx={{ alignSelf: "flex-start" }}
          >
            Open Create User Form
          </Button>
        </Stack>
      </Paper>

      {/* Last Created User Display */}
      {lastCreatedUser && (
        <Paper sx={{ p: 3, mb: 3, backgroundColor: "success.50" }}>
          <Typography variant="h6" gutterBottom color="success.main">
            ✓ User Created Successfully!
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Typography variant="body2" gutterBottom>
            <strong>Name:</strong> {lastCreatedUser.firstName}{" "}
            {lastCreatedUser.lastName}
          </Typography>
          <Typography variant="body2" gutterBottom>
            <strong>Email:</strong> {lastCreatedUser.email}
          </Typography>
          <Typography variant="body2" gutterBottom>
            <strong>Phone:</strong> {lastCreatedUser.phoneNumber}
          </Typography>
          <Typography variant="body2" gutterBottom>
            <strong>Role:</strong> {lastCreatedUser.role}
          </Typography>
          <Typography variant="body2" gutterBottom>
            <strong>Status:</strong> {lastCreatedUser.status}
          </Typography>
          <Typography variant="body2">
            <strong>Companies:</strong>{" "}
            {lastCreatedUser.assignedCompanies.length} assigned
          </Typography>
        </Paper>
      )}

      {/* Integration Instructions */}
      <Paper sx={{ p: 3, backgroundColor: "info.50" }}>
        <Typography variant="h6" gutterBottom>
          Integration Instructions
        </Typography>
        <Typography variant="body2" paragraph>
          To use this component in your application:
        </Typography>
        <Box component="ol" sx={{ pl: 2 }}>
          <Typography component="li" variant="body2" sx={{ mb: 1 }}>
            <strong>Import the component:</strong>{" "}
            <code>import CreateUserModal from './CreateUserModal'</code>
          </Typography>
          <Typography component="li" variant="body2" sx={{ mb: 1 }}>
            <strong>Add state management:</strong>{" "}
            <code>const [isModalOpen, setIsModalOpen] = useState(false)</code>
          </Typography>
          <Typography component="li" variant="body2" sx={{ mb: 1 }}>
            <strong>Create handler function:</strong> Implement your API call
            logic in the onSave prop
          </Typography>
          <Typography component="li" variant="body2" sx={{ mb: 1 }}>
            <strong>Render the modal:</strong> Include the component with
            required props
          </Typography>
        </Box>
      </Paper>

      {/* Props Documentation */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Component Props
        </Typography>
        <Stack spacing={2}>
          <Box>
            <Typography variant="subtitle2" fontWeight="bold">
              isOpen (boolean)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Controls whether the modal is visible
            </Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" fontWeight="bold">
              onClose (function)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Callback function to close the modal
            </Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" fontWeight="bold">
              onSave (function)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Callback function called when form is submitted successfully
            </Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" fontWeight="bold">
              companies (array)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Array of company objects with id and name properties
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Create User Modal */}
      <CreateUserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleCreateUser}
        companies={companies}
        currentUserAccess={currentUserAccess}
      />
    </Box>
  );
};

export default UserFormExample;
