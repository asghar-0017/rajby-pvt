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

  // Function to call external API and store Rajbytoken
  const callExternalLoginAPI = async () => {
    try {
      const response = await api.post("/rajby-login");

      if (response.data && response.data.token) {
        localStorage.setItem("Rajbytoken", response.data.token);
        console.log("External API login successful, token stored as Rajbytoken");
      }
    } catch (error) {
      console.error("External API login error:", error);
      // Don't throw error - allow login to proceed even if external API fails
    }
  };

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

        // Store token and sanitized user data
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(sanitizeUser(userData)));

        // Debug: Log user data
        console.log("AuthProvider: Login successful");
        console.log("AuthProvider: User data:", userData);
        console.log("AuthProvider: User role:", userData.role);
        console.log("AuthProvider: Assigned tenants:", userData.assignedTenants);
        console.log("AuthProvider: Number of assigned tenants:", userData.assignedTenants?.length || 0);

        setUser(sanitizeUser(userData));
        setIsAuthenticated(true);

        // Call external API after successful login
        await callExternalLoginAPI();

        // Show success message
        // Swal.fire({
        //   icon: 'success',
        //   title: 'Login Successful!',
        //   text: 'Welcome to FBR Integration System',
        //   timer: 2000,
        //   showConfirmButton: false
        // });

        // Redirect based on user role and preload tenant tokens for single-assignment users
        if (userData.role === "admin") {
          navigate("/tenant-management");
        } else {
          // For regular users, check assignments
          if (
            userData.assignedTenants &&
            userData.assignedTenants.length === 1
          ) {
            const onlyTenant = userData.assignedTenants[0];
            try {
              // Fetch complete tenant details including tokens
              const tenantResp = await api.get(
                `/user/tenants/${onlyTenant.tenantId}`
              );
              if (tenantResp?.data?.success && tenantResp.data.data) {
                const tenantWithTokens = tenantResp.data.data;
                // Persist sanitized tenant only (no token)
                const { sandboxProductionToken, ...sanitized } =
                  tenantWithTokens;
                localStorage.setItem(
                  "selectedTenant",
                  JSON.stringify(sanitized)
                );
              }
            } catch (e) {
              // Non-fatal: proceed without preloading tokens
              console.warn(
                "Preload tenant tokens on login failed:",
                e?.message || e
              );
            }
            navigate("/");
          } else if (
            userData.assignedTenants &&
            userData.assignedTenants.length > 1
          ) {
            // Multiple companies - go to selection
            navigate("/tenant-management");
          } else {
            // No companies assigned - still allow dashboard which will show message
            navigate("/");
          }
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
          localStorage.setItem("user", JSON.stringify(sanitizeUser(userData)));

          setUser(sanitizeUser(userData));
          setIsAuthenticated(true);

          // Call external API after successful login
          await callExternalLoginAPI();

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
        const sanitized = sanitizeUser(userData);
        setUser(sanitized);
        localStorage.setItem("user", JSON.stringify(sanitized));
        return sanitized;
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
        const sanitized = sanitizeUser(userData);
        setUser(sanitized);
        localStorage.setItem("user", JSON.stringify(sanitized));

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
            errorMessage =
              "Email service is not configured. Please contact support.";
          } else if (
            data &&
            data.message &&
            data.message.includes("unavailable")
          ) {
            errorMessage =
              "Email service is temporarily unavailable. Please try again later.";
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
        errorMessage =
          "Network error. Please check your connection and try again.";
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

// Helper: remove any token fields from nested tenant structures
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
