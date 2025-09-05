import React, { useState } from "react";
import PasswordUpdateModal from "./PasswordUpdateModal";
import { useAuth } from "../Context/AuthProvider";
import { api } from "../API/Api";

export default function PasswordUpdateMenuMount({ open, setOpen }) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  const handleSave = async (data) => {
    try {
      setSaving(true);
      
      // Determine the appropriate endpoint based on user type
      const endpoint = user?.role === "admin" 
        ? "/auth/change-password" 
        : "/user-auth/change-password";

      const response = await api.put(endpoint, {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });

      if (response.data?.success) {
        // Close the modal first
        setOpen(false);
        
        // Show success message
        const { default: Swal } = await import("sweetalert2");
        await Swal.fire({
          icon: "success",
          title: "Password Changed Successfully",
          text: "Your password has been changed successfully. You will be redirected to login page.",
          confirmButtonText: "OK",
          zIndex: 9999, // Ensure it appears above everything
          allowOutsideClick: false,
          allowEscapeKey: false,
        });
        
        // Clear all auth data and redirect to login
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/";
      } else {
        throw new Error(response.data?.message || "Failed to change password");
      }
    } catch (error) {
      console.error("Error changing password:", error);
      
      // Show error message with high z-index
      const { default: Swal } = await import("sweetalert2");
      await Swal.fire({
        icon: "error",
        title: "Password Change Failed",
        text: error.response?.data?.message || error.message || "Failed to change password",
        confirmButtonText: "OK",
        zIndex: 9999, // Ensure it appears above the modal
      });
      
      // Don't re-throw the error to prevent the modal from getting stuck
    } finally {
      setSaving(false);
    }
  };

  return (
    <PasswordUpdateModal
      open={open}
      onClose={() => setOpen(false)}
      onSave={handleSave}
      isSaving={saving}
    />
  );
}
