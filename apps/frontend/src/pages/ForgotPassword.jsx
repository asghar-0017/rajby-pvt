import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  TextField,
  Paper,
  Typography,
  Box,
  Avatar,
} from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";
import { useAuth } from "../Context/AuthProvider";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { forgotPassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!email) {
      const errorMsg = "Please enter your email address.";
      toast.error(errorMsg, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      setError(errorMsg);
      setLoading(false);
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      const errorMsg = "Please enter a valid email address.";
      toast.error(errorMsg, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      setError(errorMsg);
      setLoading(false);
      return;
    }

    try {
      const result = await forgotPassword(email);
      
      if (result === true) {
        // Store email for the next step
        localStorage.setItem("email", email);
        
        // Navigate to OTP page to enter the reset code
        navigate("/otp");
      } else {
        const errorMsg = "Failed to send reset code";
        setError(errorMsg);
      }
    } catch (error) {
      console.error("Forgot password error:", error);
      const errorMsg = error.message || "Failed to send reset code. Please try again.";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row lg:h-screen">
      {/* Forgot Password Form Section */}
      <div className="flex-1 bg-[#EDEDED] flex justify-center items-center p-4 lg:p-6 order-2 lg:order-1">
        <Paper
          elevation={6}
          sx={{
            padding: { xs: 2, sm: 3 },
            width: "100%",
            maxWidth: { xs: 350, sm: 420 },
            minHeight: { xs: "auto", sm: 420 },
            textAlign: "center",
            borderRadius: 3,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
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
            <Avatar
              sx={{
                m: 1,
                bgcolor: "#ED5B2A",
                width: 56,
                height: 56,
              }}
            >
              <EmailIcon sx={{ fontSize: 28 }} />
            </Avatar>
            <Typography
              component="h1"
              variant="h5"
              sx={{
                fontWeight: 700,
                color: "#333",
                mb: 1,
              }}
            >
              Forgot Password
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: "#666",
                textAlign: "center",
                maxWidth: 300,
              }}
            >
              Enter your email address and we'll send you a reset code to reset your password.
            </Typography>
          </Box>

          <form onSubmit={handleSubmit}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email Address"
              name="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={{
                "& .MuiOutlinedInput-root": {
                  "&:hover fieldset": {
                    borderColor: "#ED5B2A",
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: "#ED5B2A",
                  },
                },
                "& .MuiInputLabel-root.Mui-focused": {
                  color: "#ED5B2A",
                },
              }}
            />

            {error && (
              <Typography
                color="error"
                variant="body2"
                sx={{ mt: 1, fontSize: { xs: "0.75rem", sm: "0.875rem" } }}
              >
                {error}
              </Typography>
            )}

            <Button
              type="submit"
              variant="contained"
              size="small"
              fullWidth
              disabled={loading}
              sx={{
                mt: { xs: 3, sm: 4 },
                backgroundColor: "#2655A2",
                height: { xs: 40, sm: 44 },
                borderRadius: 2,
                fontSize: { xs: "0.875rem", sm: "1rem" },
                "&:hover": {
                  backgroundColor: "#1e4082",
                },
                "&:disabled": {
                  backgroundColor: "#ccc",
                },
              }}
            >
              {loading ? "Sending..." : "Send Reset Code"}
            </Button>

            <Button
              onClick={() => navigate("/login")}
              sx={{
                mt: 2,
                color: "#ED5B2A",
                textDecoration: "none",
                fontSize: { xs: "0.75rem", sm: "0.875rem" },
                fontWeight: 600,
                textTransform: "none",
                "&:hover": {
                  backgroundColor: "transparent",
                  textDecoration: "underline",
                },
              }}
            >
              Back to Login
            </Button>
          </form>
        </Paper>
      </div>

      {/* Branding Section */}
      <div className="flex-1 flex flex-col justify-center items-center p-4 lg:p-6 order-1 lg:order-2 bg-white min-h-[50vh] lg:h-full lg:min-h-0">
        {/* Top Logos */}
        <div className="w-full flex justify-between items-center mb-4 lg:mb-6 max-w-md lg:max-w-lg">
          <img
            className="w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 object-contain"
            src="images/fbr-logo-1.png"
            alt="FBR Logo"
          />
          <img
            className="w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 object-contain"
            src="images/pral.png"
            alt="PRAL Logo"
          />
        </div>

        {/* Top Border Line */}
        <div className="w-full max-w-md lg:max-w-lg border-b-2 border-[#FB5B24] mb-4 lg:mb-6"></div>

        {/* Main Image and Text */}
        <div className="flex flex-col justify-center items-center flex-1 max-w-md lg:max-w-lg">
          <div className="relative w-full flex justify-center mb-4">
            <img
              src="images/innovative.png"
              className="w-48 h-48 sm:w-64 sm:h-64 lg:w-72 lg:h-72 xl:w-80 xl:h-80 object-contain"
              alt="Innovation Logo"
            />
          </div>

          <Typography
            variant="h5"
            component="p"
            sx={{
              textAlign: "center",
              fontWeight: 700,
              fontSize: { xs: "1rem", sm: "1.25rem", lg: "1.5rem" },
              lineHeight: 1.4,
              color: "#333",
              mb: 2,
            }}
          >
            FBR Digital Invoicing is Easy Now <br /> With INPL
          </Typography>
        </div>

        {/* Bottom Border Line */}
        <div className="w-full max-w-md lg:max-w-lg border-b-2 border-[#FB5B24] mt-4 lg:mt-6"></div>
      </div>
    </div>
  );
};

export default ForgotPassword;
