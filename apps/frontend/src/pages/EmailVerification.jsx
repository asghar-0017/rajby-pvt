import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, TextField, Paper, Typography, Box } from "@mui/material";
import axios from "axios";
import { API_CONFIG } from "../API/Api";
import { toast } from "react-toastify";

const { apiKeyLocal } = API_CONFIG;

const EmailVerification = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(""); // Clear previous errors

    try {
      // Normalize email to lowercase to match backend
      const normalizedEmail = email.toLowerCase();
      const response = await axios.post(`${apiKeyLocal}/auth/forgot-password`, {
        email: normalizedEmail,
      });

      // Log response for debugging
      console.log("API Response:", response.data);

      // Check if email exists
      if (response.data.exists === false) {
        const errorMsg =
          response.data.message ||
          "This email is not registered. Please try again.";
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

      // If exists and successful
      if (response.data.success) {
        toast.success(
          "Verification code sent successfully! Please check your email.",
          {
            position: "top-right",
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          }
        );
        navigate("/otp");
        localStorage.setItem("email", normalizedEmail);
      } else {
        const errorMsg =
          response.data.message || "Failed to send verification code";
        toast.error(errorMsg, {
          position: "top-center",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
        setError(errorMsg);
      }
    } catch (error) {
      const errorMsg =
        error.response?.data?.message || "Failed to send verification code";
      toast.error(errorMsg, {
        position: "top-center",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      setError(errorMsg);
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row lg:h-screen">
      {/* Email Verification Form Section */}
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
              alignItems: "flex-start",
              mb: 2,
            }}
          >
            <Typography
              variant="h4"
              component="p"
              sx={{
                fontSize: { xs: "1.5rem", sm: "2rem" },
                fontWeight: 600,
                mb: 0.5,
              }}
            >
              Email Verification
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: "gray",
                fontSize: { xs: "0.8rem", sm: "0.875rem" },
              }}
            >
              Enter your email to receive verification code
            </Typography>
          </Box>

          <form onSubmit={handleSubmit}>
            <TextField
              label="Email"
              variant="outlined"
              size="small"
              fullWidth
              margin="normal"
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: 2,
                },
              }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
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
                mt: { xs: 3, sm: 5 },
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
              {loading ? "Sending..." : "Send Verification Code"}
            </Button>

            <Button
              variant="outlined"
              size="small"
              fullWidth
              onClick={() => navigate("/login")}
              sx={{
                mt: 2,
                borderColor: "#2655A2",
                color: "#2655A2",
                height: { xs: 36, sm: 40 },
                borderRadius: 2,
                fontSize: { xs: "0.75rem", sm: "0.875rem" },
                "&:hover": {
                  borderColor: "#1e4082",
                  backgroundColor: "rgba(38, 85, 162, 0.04)",
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

        <div className="w-full max-w-md lg:max-w-lg border-b-2 border-[#FB5B24] mb-4 lg:mb-6"></div>

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

        <div className="w-full max-w-md lg:max-w-lg border-b-2 border-[#FB5B24] mt-4 lg:mt-6"></div>
      </div>
      
    </div>
  );
};

export default EmailVerification;
