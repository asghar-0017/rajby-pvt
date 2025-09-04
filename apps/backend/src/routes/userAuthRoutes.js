import express from "express";
import {
  userLogin,
  getUserProfile,
} from "../controller/mysql/userAuthController.js";
import { authenticateToken } from "../middleWare/authMiddleware.js";

const router = express.Router();

// Public routes
router.post("/login", userLogin);

// Protected routes
router.get("/profile", authenticateToken, getUserProfile);

export default router;
