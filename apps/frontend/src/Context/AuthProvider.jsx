import { createContext, useContext, useEffect, useState } from "react";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";
import { api } from "../API/Api";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);

  const navigate = useNavigate();

  const login = async (email, password) => {
    try {
      setAuthLoading(true);

      const response = await api.post("/auth/login", {
        email,
        password,
      });

      // Check if the response follows the new format
      if (response.data.success && response.data.data) {
        const { token, user: userData } = response.data.data;

        // Store token and user data
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(userData));

        setUser(userData);
        setIsAuthenticated(true);

        // Show success message
        // Swal.fire({
        //   icon: 'success',
        //   title: 'Login Successful!',
        //   text: 'Welcome to FBR Integration System',
        //   timer: 2000,
        //   showConfirmButton: false
        // });

        // Redirect based on user role and reload the screen
        if (userData.role === "admin") {
          navigate("/tenant-management");
        } else {
          navigate("/");
        }

        // Reload the screen after successful login
        // setTimeout(() => {
        //   window.location.reload();
        // }, 100);
        // } else {
        // Handle legacy response format
        if (response.data.data && response.data.data.token) {
          const { token, user: userData } = response.data.data;

          localStorage.setItem("token", token);
          localStorage.setItem("user", JSON.stringify(userData));

          setUser(userData);
          setIsAuthenticated(true);

          // Swal.fire({
          //   icon: 'success',
          //   title: 'Login Successful!',
          //   text: 'Welcome to FBR Integration System',
          //   timer: 2000,
          //   showConfirmButton: false
          // });

          // Redirect based on user role and reload the screen
          if (userData.role === "admin") {
            navigate("/tenant-management");
          } else {
            navigate("/");
          }

          // Reload the screen after successful login
          // setTimeout(() => {
          //   window.location.reload();
          // }, 100);
        } else {
          throw new Error("Invalid response format");
        }
      }
    } catch (err) {
      console.error("Login error:", err);

      let errorMessage = "Login failed. Please try again.";

      if (err.response) {
        const { data, status } = err.response;

        if (data && data.message) {
          errorMessage = data.message;
        } else if (status === 401) {
          errorMessage = "Invalid email or password";
        } else if (status === 429) {
          errorMessage = "Too many login attempts. Please try again later.";
        } else if (status === 400) {
          errorMessage = "Please check your input and try again.";
        }
      }

      Swal.fire({
        icon: "error",
        title: "Login Failed",
        text: errorMessage,
        confirmButtonText: "OK",
      });

      throw new Error(errorMessage);
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = async () => {
    try {
      const token = localStorage.getItem("token");

      if (token) {
        await api.get("/auth/logout");
      }
    } catch (err) {
      console.error("Logout API error:", err);
      // Don't show error to user for logout failures
    } finally {
      // Always clear local state regardless of API call success
      setIsAuthenticated(false);
      setUser(null);
      localStorage.clear();

      // Swal.fire({
      //   icon: 'success',
      //   title: 'Logged Out',
      //   text: 'You have been successfully logged out',
      //   timer: 2000,
      //   showConfirmButton: false
      // });

      navigate("/login");

      // Reload the screen after logout
      // setTimeout(() => {
      //   window.location.reload();
      // }, 100);
    }
  };

  const verifyToken = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        setIsAuthenticated(false);
        setUser(null);
        setAuthLoading(false);
        return false;
      }

      const response = await api.get("/auth/verify-token");

      if (
        response.data.success &&
        response.data.data &&
        response.data.data.isValid
      ) {
        const userData = response.data.data.user;
        setUser(userData);
        setIsAuthenticated(true);
        return true;
      } else {
        // Token is invalid
        localStorage.clear();
        setIsAuthenticated(false);
        setUser(null);
        return false;
      }
    } catch (err) {
      console.error("Token verification error:", err);
      localStorage.clear();
      setIsAuthenticated(false);
      setUser(null);
      return false;
    }
  };

  const getProfile = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        return null;
      }

      const response = await api.get("/auth/profile");

      if (response.data.success && response.data.data) {
        const userData = response.data.data.user;
        setUser(userData);
        localStorage.setItem("user", JSON.stringify(userData));
        return userData;
      }

      return null;
    } catch (err) {
      console.error("Get profile error:", err);
      return null;
    }
  };

  const updateProfile = async (profileData) => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        throw new Error("No authentication token");
      }

      const response = await api.put("/auth/profile", profileData);

      if (response.data.success && response.data.data) {
        const userData = response.data.data.user;
        setUser(userData);
        localStorage.setItem("user", JSON.stringify(userData));

        Swal.fire({
          icon: "success",
          title: "Profile Updated",
          text: "Your profile has been updated successfully",
          timer: 2000,
          showConfirmButton: false,
        });

        return userData;
      }

      throw new Error("Failed to update profile");
    } catch (err) {
      console.error("Update profile error:", err);

      let errorMessage = "Failed to update profile";
      if (err.response && err.response.data && err.response.data.message) {
        errorMessage = err.response.data.message;
      }

      Swal.fire({
        icon: "error",
        title: "Update Failed",
        text: errorMessage,
        confirmButtonText: "OK",
      });

      throw new Error(errorMessage);
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        throw new Error("No authentication token");
      }

      const response = await api.put("/auth/change-password", {
        currentPassword,
        newPassword,
      });

      if (response.data.success) {
        Swal.fire({
          icon: "success",
          title: "Password Changed",
          text: "Your password has been changed successfully. Please login again.",
          confirmButtonText: "OK",
        });

        // Logout after password change
        await logout();
        return true;
      }

      throw new Error("Failed to change password");
    } catch (err) {
      console.error("Change password error:", err);

      let errorMessage = "Failed to change password";
      if (err.response && err.response.data && err.response.data.message) {
        errorMessage = err.response.data.message;
      }

      Swal.fire({
        icon: "error",
        title: "Password Change Failed",
        text: errorMessage,
        confirmButtonText: "OK",
      });

      throw new Error(errorMessage);
    }
  };

  const forgotPassword = async (email) => {
    try {
      const response = await api.post("/auth/forgot-password", {
        email,
      });

      if (response.data.success) {
        Swal.fire({
          icon: "success",
          title: "Reset Code Sent",
          text: "If the email exists, a reset code has been sent to your email.",
          confirmButtonText: "OK",
        });

        return true;
      }

      throw new Error("Failed to send reset code");
    } catch (err) {
      console.error("Forgot password error:", err);

      let errorMessage = "Failed to send reset code";
      
      if (err.response) {
        const { data, status } = err.response;
        
        if (data && data.message) {
          errorMessage = data.message;
        } else if (status === 500) {
          if (data && data.message && data.message.includes("configuration")) {
            errorMessage = "Email service is not configured. Please contact support.";
          } else if (data && data.message && data.message.includes("unavailable")) {
            errorMessage = "Email service is temporarily unavailable. Please try again later.";
          } else {
            errorMessage = "Server error occurred. Please try again later.";
          }
        } else if (status === 400) {
          errorMessage = "Invalid email address. Please check and try again.";
        } else if (status === 429) {
          errorMessage = "Too many attempts. Please wait before trying again.";
        }
      } else if (err.request) {
        // Network error
        errorMessage = "Network error. Please check your connection and try again.";
      } else if (err.message) {
        errorMessage = err.message;
      }

      Swal.fire({
        icon: "error",
        title: "Reset Failed",
        text: errorMessage,
        confirmButtonText: "OK",
      });

      throw new Error(errorMessage);
    }
  };

  const verifyResetCode = async (email, code) => {
    try {
      const response = await api.post("/auth/verify-reset-code", {
        email,
        code,
      });

      if (response.data.success) {
        return true;
      }

      throw new Error("Invalid reset code");
    } catch (err) {
      console.error("Verify reset code error:", err);

      let errorMessage = "Invalid reset code";
      if (err.response && err.response.data && err.response.data.message) {
        errorMessage = err.response.data.message;
      }

      throw new Error(errorMessage);
    }
  };

  const resetPassword = async (email, code, newPassword) => {
    try {
      const response = await api.put("/auth/reset-password", {
        email,
        code,
        newPassword,
      });

      if (response.data.success) {
        Swal.fire({
          icon: "success",
          title: "Password Reset",
          text: "Your password has been reset successfully. Please login with your new password.",
          confirmButtonText: "OK",
        });

        navigate("/login");
        return true;
      }

      throw new Error("Failed to reset password");
    } catch (err) {
      console.error("Reset password error:", err);

      let errorMessage = "Failed to reset password";
      if (err.response && err.response.data && err.response.data.message) {
        errorMessage = err.response.data.message;
      }

      Swal.fire({
        icon: "error",
        title: "Reset Failed",
        text: errorMessage,
        confirmButtonText: "OK",
      });

      throw new Error(errorMessage);
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setAuthLoading(true);

        // Check if user data exists in localStorage
        const storedUser = localStorage.getItem("user");
        const token = localStorage.getItem("token");

        if (token && storedUser) {
          // Verify token with server
          const isValid = await verifyToken();

          if (!isValid) {
            // Token is invalid, clear everything
            localStorage.clear();
            setIsAuthenticated(false);
            setUser(null);
          }
        } else {
          // No stored data
          setIsAuthenticated(false);
          setUser(null);
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        localStorage.clear();
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        setAuthLoading(false);
      }
    };

    initializeAuth();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        login,
        logout,
        authLoading,
        getProfile,
        updateProfile,
        changePassword,
        forgotPassword,
        verifyResetCode,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
