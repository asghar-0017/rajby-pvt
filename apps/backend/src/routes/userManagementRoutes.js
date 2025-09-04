import express from "express";
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  assignUserToTenant,
  removeUserFromTenant,
  getAllTenants,
  getUsersByTenant,
} from "../controller/mysql/userManagementController.js";
import {
  authenticateToken,
  requireAdmin,
} from "../middleWare/authMiddleware.js";

const router = express.Router();

// All routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

// User management routes
router.get("/users", getAllUsers);
router.get("/users/:id", getUserById);
router.post("/users", createUser);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);

// User-tenant assignment routes
router.post("/users/assign-tenant", assignUserToTenant);
router.post("/users/remove-tenant", removeUserFromTenant);

// Tenant management routes
router.get("/tenants", getAllTenants);
router.get("/tenants/:tenantId/users", getUsersByTenant);

export default router;
