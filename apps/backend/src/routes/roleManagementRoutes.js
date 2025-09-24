import express from "express";
import { authenticateToken, requireAdmin } from "../middleWare/authMiddleware.js";
import { requireAdminOrPermission } from "../middleWare/permissionMiddleware.js";
import roleManagementController from "../controller/mysql/roleManagementController.js";

const router = express.Router();

// All routes require authentication and role management permissions
router.use(authenticateToken);
router.use(requireAdminOrPermission('read_role'));

// Role management routes
router.get("/roles", roleManagementController.getAllRoles);
router.get("/permissions", roleManagementController.getAllPermissions);
router.get("/permissions/grouped", roleManagementController.getPermissionsGroupedByResource);
router.get("/roles/:roleId", roleManagementController.getRoleById);
router.post("/roles", roleManagementController.createRole);
router.put("/roles/:roleId", roleManagementController.updateRole);
router.delete("/roles/:roleId", roleManagementController.deleteRole);

// User permission routes
router.get("/users/:userId/permissions", roleManagementController.getUserPermissions);
router.get("/users/:userId/check-permission", roleManagementController.checkUserPermission);

export default router;