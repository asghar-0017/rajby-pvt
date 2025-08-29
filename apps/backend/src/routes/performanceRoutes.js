import express from "express";
import * as performanceController from "../controller/mysql/performanceController.js";
import { identifyTenant } from "../middleWare/tenantMiddleware.js";
import { authenticateToken } from "../middleWare/authMiddleware.js";

const router = express.Router();

// Apply middleware for all performance routes
router.use(authenticateToken, identifyTenant);

// Performance monitoring routes
router.get("/metrics", performanceController.getPerformanceMetrics);
router.get("/upload-performance", performanceController.getUploadPerformance);
router.get("/optimization-recommendations", performanceController.getOptimizationRecommendations);

export default router;
