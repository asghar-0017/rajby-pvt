import express from "express";
import {
  userLogin,
  getUserProfile,
  changeUserPassword,
} from "../controller/mysql/userAuthController.js";
import { authenticateToken } from "../middleWare/authMiddleware.js";
import roleManagementController from "../controller/mysql/roleManagementController.js";

const router = express.Router();

// Public routes
router.post("/login", userLogin);

// Protected routes
router.get("/profile", authenticateToken, getUserProfile);
router.put("/change-password", authenticateToken, changeUserPassword);

// User permission routes (users can access their own permissions)
router.get("/my-permissions", authenticateToken, roleManagementController.getMyPermissions);
router.get("/check-my-permission", authenticateToken, roleManagementController.checkMyPermission);

export default router;
