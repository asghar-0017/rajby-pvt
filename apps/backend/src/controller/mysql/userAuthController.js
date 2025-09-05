import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import UserManagementService from "../../service/UserManagementService.js";
import { formatResponse } from "../../utils/formatResponse.js";

// User login
export const userLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Input validation
    if (!email || !password) {
      return res
        .status(400)
        .json(
          formatResponse(false, "Email and password are required", null, 400)
        );
    }

    // Find user with tenant assignments
    const user = await UserManagementService.getUserByEmail(email);

    if (!user) {
      return res
        .status(401)
        .json(formatResponse(false, "Invalid email or password", null, 401));
    }

    // Check if user is active
    if (!user.isActive) {
      return res
        .status(401)
        .json(formatResponse(false, "Account is deactivated", null, 401));
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res
        .status(401)
        .json(formatResponse(false, "Invalid email or password", null, 401));
    }

    // Check if user has any tenant assignments
    if (
      !user.UserTenantAssignments ||
      user.UserTenantAssignments.length === 0
    ) {
      return res
        .status(403)
        .json(
          formatResponse(
            false,
            "No company assigned to this user. Please contact administrator.",
            null,
            403
          )
        );
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        type: "user",
        assignedTenants: user.UserTenantAssignments.map((assignment) => ({
          tenantId: assignment.Tenant.tenant_id,
          tenantName: assignment.Tenant.seller_business_name,
          databaseName: assignment.Tenant.database_name,
        })),
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    // Prepare user data for response (without password)
    const userData = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      assignedTenants: user.UserTenantAssignments.map((assignment) => ({
        tenantId: assignment.Tenant.tenant_id,
        tenantName: assignment.Tenant.seller_business_name,
        databaseName: assignment.Tenant.database_name,
      })),
    };

    return res.status(200).json(
      formatResponse(
        true,
        "Login successful",
        {
          token,
          user: userData,
        },
        200
      )
    );
  } catch (error) {
    console.error("Error in userLogin:", error);
    return res
      .status(500)
      .json(formatResponse(false, "Login failed", null, 500, error.message));
  }
};

// Get user profile
export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await UserManagementService.getUserById(userId);

    if (!user) {
      return res
        .status(404)
        .json(formatResponse(false, "User not found", null, 404));
    }

    // Prepare user data for response (without password)
    const userData = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      assignedTenants:
        user.UserTenantAssignments?.map((assignment) => ({
          tenantId: assignment.Tenant.tenant_id,
          tenantName: assignment.Tenant.seller_business_name,
          databaseName: assignment.Tenant.database_name,
        })) || [],
    };

    return res
      .status(200)
      .json(
        formatResponse(true, "User profile fetched successfully", userData, 200)
      );
  } catch (error) {
    console.error("Error in getUserProfile:", error);
    return res
      .status(500)
      .json(
        formatResponse(
          false,
          "Failed to fetch user profile",
          null,
          500,
          error.message
        )
      );
  }
};

// Change user password
export const changeUserPassword = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

    // Input validation
    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json(
          formatResponse(
            false,
            "Current password and new password are required",
            null,
            400
          )
        );
    }

    // Password validation - same as admin
    const validatePassword = (password) => {
      // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
      return passwordRegex.test(password);
    };

    if (!validatePassword(newPassword)) {
      return res
        .status(400)
        .json(
          formatResponse(
            false,
            "New password must be at least 8 characters long and contain uppercase, lowercase, and number",
            null,
            400
          )
        );
    }

    // Get user
    const user = await UserManagementService.getUserById(userId);
    if (!user) {
      return res
        .status(404)
        .json(formatResponse(false, "User not found", null, 404));
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isCurrentPasswordValid) {
      return res
        .status(401)
        .json(
          formatResponse(false, "Current password is incorrect", null, 401)
        );
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await UserManagementService.updateUser(userId, { password: hashedNewPassword });

    return res
      .status(200)
      .json(
        formatResponse(
          true,
          "Password changed successfully. Please login again."
        )
      );
  } catch (error) {
    console.error("Change user password error:", error);
    return res
      .status(500)
      .json(formatResponse(false, "Internal server error", null, 500));
  }
};
