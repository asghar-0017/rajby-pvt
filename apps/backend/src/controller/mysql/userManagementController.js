import UserManagementService from "../../service/UserManagementService.js";
import { formatResponse } from "../../utils/formatResponse.js";

// Get all users
export const getAllUsers = async (req, res) => {
  try {
    const users = await UserManagementService.getAllUsers();

    return res
      .status(200)
      .json(formatResponse(true, "Users fetched successfully", users, 200));
  } catch (error) {
    console.error("Error in getAllUsers:", error);
    return res
      .status(500)
      .json(
        formatResponse(false, "Failed to fetch users", null, 500, error.message)
      );
  }
};

// Get user by ID
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await UserManagementService.getUserById(id);

    if (!user) {
      return res
        .status(404)
        .json(formatResponse(false, "User not found", null, 404));
    }

    return res
      .status(200)
      .json(formatResponse(true, "User fetched successfully", user, 200));
  } catch (error) {
    console.error("Error in getUserById:", error);
    return res
      .status(500)
      .json(
        formatResponse(false, "Failed to fetch user", null, 500, error.message)
      );
  }
};

// Create new user
export const createUser = async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, role, isActive, tenantIds } =
      req.body;
    const createdByAdminId = req.user.id; // Admin who is creating the user

    // Validate required fields
    if (!email || !password || !firstName || !lastName) {
      return res
        .status(400)
        .json(
          formatResponse(
            false,
            "Email, password, first name, and last name are required",
            null,
            400
          )
        );
    }

    // Create user
    const user = await UserManagementService.createUser(
      {
        email,
        password,
        firstName,
        lastName,
        phone,
        role,
        isActive,
      },
      createdByAdminId
    );

    // Assign user to tenants if provided
    if (tenantIds && Array.isArray(tenantIds) && tenantIds.length > 0) {
      for (const tenantId of tenantIds) {
        try {
          await UserManagementService.assignUserToTenant(
            user.id,
            tenantId,
            createdByAdminId
          );
        } catch (assignmentError) {
          console.warn(
            `Failed to assign user to tenant ${tenantId}:`,
            assignmentError.message
          );
        }
      }
    }

    // Fetch the complete user data with assignments
    const completeUser = await UserManagementService.getUserById(user.id);

    return res
      .status(201)
      .json(
        formatResponse(true, "User created successfully", completeUser, 201)
      );
  } catch (error) {
    console.error("Error in createUser:", error);
    let status = 500;
    let message = "Failed to create user";

    if (error.name === "SequelizeUniqueConstraintError") {
      status = 409;
      message = "User with this email already exists";
    } else if (error.name === "SequelizeValidationError") {
      status = 400;
      const details = (error.errors || []).map((e) => e.message).join(", ");
      message = details || "Validation failed";
    } else if (error.message?.includes("exists")) {
      status = 409;
      message = "User with this email already exists";
    }

    const detail = error.original?.sqlMessage || error.message;
    return res.status(status).json(formatResponse(false, message, null, status, detail));
  }
};

// Update user
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantIds, ...updateData } = req.body; // Extract tenantIds from updateData
    const updatedByAdminId = req.user.id;

    // Remove sensitive fields that shouldn't be updated directly
    delete updateData.id;
    delete updateData.created_at;
    delete updateData.updated_at;

    // Update user basic information
    const user = await UserManagementService.updateUser(id, updateData);

    // Handle company assignments if provided
    if (tenantIds && Array.isArray(tenantIds)) {
      try {
        // First, remove all existing assignments
        await UserManagementService.removeAllUserTenantAssignments(id);

        // Then, assign to new companies
        if (tenantIds.length > 0) {
          for (const tenantId of tenantIds) {
            try {
              await UserManagementService.assignUserToTenant(
                id,
                tenantId,
                updatedByAdminId
              );
            } catch (assignmentError) {
              console.warn(
                `Failed to assign user to tenant ${tenantId}:`,
                assignmentError.message
              );
            }
          }
        }
      } catch (assignmentError) {
        console.error("Error updating company assignments:", assignmentError);
        // Continue with user update even if company assignment fails
      }
    }

    // Fetch the complete updated user data with assignments
    const completeUser = await UserManagementService.getUserById(id);

    return res
      .status(200)
      .json(
        formatResponse(true, "User updated successfully", completeUser, 200)
      );
  } catch (error) {
    console.error("Error in updateUser:", error);
    return res
      .status(500)
      .json(
        formatResponse(false, "Failed to update user", null, 500, error.message)
      );
  }
};

// Delete user
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    await UserManagementService.deleteUser(id);

    return res
      .status(200)
      .json(formatResponse(true, "User deleted successfully", null, 200));
  } catch (error) {
    console.error("Error in deleteUser:", error);
    return res
      .status(500)
      .json(
        formatResponse(false, "Failed to delete user", null, 500, error.message)
      );
  }
};

// Assign user to tenant
export const assignUserToTenant = async (req, res) => {
  try {
    const { userId, tenantId } = req.body;
    const assignedByAdminId = req.user.id;

    if (!userId || !tenantId) {
      return res
        .status(400)
        .json(
          formatResponse(false, "User ID and Tenant ID are required", null, 400)
        );
    }

    const assignment = await UserManagementService.assignUserToTenant(
      userId,
      tenantId,
      assignedByAdminId
    );

    return res
      .status(200)
      .json(
        formatResponse(
          true,
          "User assigned to tenant successfully",
          assignment,
          200
        )
      );
  } catch (error) {
    console.error("Error in assignUserToTenant:", error);
    return res
      .status(500)
      .json(
        formatResponse(
          false,
          "Failed to assign user to tenant",
          null,
          500,
          error.message
        )
      );
  }
};

// Remove user from tenant
export const removeUserFromTenant = async (req, res) => {
  try {
    const { userId, tenantId } = req.body;

    if (!userId || !tenantId) {
      return res
        .status(400)
        .json(
          formatResponse(false, "User ID and Tenant ID are required", null, 400)
        );
    }

    const assignment = await UserManagementService.removeUserFromTenant(
      userId,
      tenantId
    );

    return res
      .status(200)
      .json(
        formatResponse(
          true,
          "User removed from tenant successfully",
          assignment,
          200
        )
      );
  } catch (error) {
    console.error("Error in removeUserFromTenant:", error);
    return res
      .status(500)
      .json(
        formatResponse(
          false,
          "Failed to remove user from tenant",
          null,
          500,
          error.message
        )
      );
  }
};

// Get all tenants for assignment
export const getAllTenants = async (req, res) => {
  try {
    const tenants = await UserManagementService.getAllTenants();

    return res
      .status(200)
      .json(formatResponse(true, "Tenants fetched successfully", tenants, 200));
  } catch (error) {
    console.error("Error in getAllTenants:", error);
    return res
      .status(500)
      .json(
        formatResponse(
          false,
          "Failed to fetch tenants",
          null,
          500,
          error.message
        )
      );
  }
};

// Get users assigned to a specific tenant
export const getUsersByTenant = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const users = await UserManagementService.getUsersByTenant(tenantId);

    return res
      .status(200)
      .json(formatResponse(true, "Users fetched successfully", users, 200));
  } catch (error) {
    console.error("Error in getUsersByTenant:", error);
    return res
      .status(500)
      .json(
        formatResponse(false, "Failed to fetch users", null, 500, error.message)
      );
  }
};
