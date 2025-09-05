import express from "express";
import {
  userLogin,
  getUserProfile,
  changeUserPassword,
} from "../controller/mysql/userAuthController.js";
import { authenticateToken } from "../middleWare/authMiddleware.js";

const router = express.Router();

// Public routes
router.post("/login", userLogin);

// Protected routes
router.get("/profile", authenticateToken, getUserProfile);
router.put("/change-password", authenticateToken, changeUserPassword);

export default router;
