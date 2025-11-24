import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../Context/AuthProvider";
import { api, performRajbyLogin } from "../API/Api";
import Swal from "sweetalert2";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Container,
  Paper,
  InputAdornment,
  IconButton,
} from "@mui/material";
import {
  Person as PersonIcon,
  Lock as LockIcon,
  Business as BusinessIcon,
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";

const UserLogin = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  // Function to call external API and store Rajbytoken
  const callExternalLoginAPI = async () => {
    try {
      const data = await performRajbyLogin();

      if (data?.token) {
        localStorage.setItem("Rajbytoken", data.token);
        console.log("External API login successful, token stored as Rajbytoken");
      }
    } catch (error) {
      console.error("External API login error:", error);
      // Don't throw error - allow login to proceed even if external API fails
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await api.post("/user-auth/login", formData);

      if (response.data.success) {
        const { token, user } = response.data.data;

        // Store token and sanitized user data (remove any tenant tokens)
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(sanitizeUser(user)));

        // Update auth context
        login(sanitizeUser(user), token);

        // Call external API after successful login
        await callExternalLoginAPI();

        Swal.fire({
          icon: "success",
          title: "Login Successful!",
          text: `Welcome ${user.firstName} ${user.lastName}`,
          timer: 2000,
          showConfirmButton: false,
        }).then(() => {
          // If user has only one company assigned, redirect to tenant selection
          if (user.assignedTenants && user.assignedTenants.length === 1) {
            // Auto-select the single company and redirect
            navigate("/", { replace: true });
          } else {
            // Redirect to company selection page
            navigate("/tenant-management", { replace: true });
          }
        });
      } else {
        setError(response.data.message || "Login failed");
      }
    } catch (error) {
      console.error("Login error:", error);
      setError(
        error.response?.data?.message || "Login failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="sm">
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          py: 4,
        }}
      >
        <Paper
          elevation={3}
          sx={{
            width: "100%",
            maxWidth: 400,
            p: 4,
            borderRadius: 2,
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              mb: 3,
            }}
          >
            <BusinessIcon
              sx={{
                fontSize: 48,
                color: "primary.main",
                mb: 2,
              }}
            />
            <Typography component="h1" variant="h4" gutterBottom>
              User Login
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center">
              Access your assigned company dashboard
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email Address"
              name="email"
              autoComplete="email"
              autoFocus
              value={formData.email}
              onChange={handleChange}
              InputProps={{
                startAdornment: (
                  <PersonIcon sx={{ mr: 1, color: "text.secondary" }} />
                ),
              }}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type={showPassword ? "text" : "password"}
              id="password"
              autoComplete="current-password"
              value={formData.password}
              onChange={handleChange}
              InputProps={{
                startAdornment: (
                  <LockIcon sx={{ mr: 1, color: "text.secondary" }} />
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                "Sign In"
              )}
            </Button>
          </Box>

          <Box sx={{ mt: 3, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Need access? Contact your administrator.
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={() => navigate("/login")}
              sx={{
                borderColor: "#2A69B0",
                color: "#2A69B0",
                "&:hover": {
                  borderColor: "#1e4a7a",
                  backgroundColor: "rgba(42, 105, 176, 0.04)",
                },
              }}
            >
              Admin Login
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default UserLogin;

// Helper: clone user and remove token fields from nested tenants
const sanitizeUser = (userData) => {
  try {
    if (!userData || typeof userData !== "object") return userData;

    const stripTenantTokens = (tenant) => {
      if (!tenant || typeof tenant !== "object") return tenant;
      const {
        sandboxProductionToken,
        sandboxTestToken,
        productionToken,
        token,
        ...rest
      } = tenant;
      return rest;
    };

    const clone = { ...userData };
    if (Array.isArray(clone.assignedTenants)) {
      clone.assignedTenants = clone.assignedTenants.map(stripTenantTokens);
    }
    if (Array.isArray(clone.tenants)) {
      clone.tenants = clone.tenants.map(stripTenantTokens);
    }
    if (clone.tenant && typeof clone.tenant === "object") {
      clone.tenant = stripTenantTokens(clone.tenant);
    }
    return clone;
  } catch (_e) {
    return userData;
  }
};
