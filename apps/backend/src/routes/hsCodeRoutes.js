import express from "express";
import {
  getHSCodes,
  searchHSCodes,
  getCacheStatus,
  clearCache,
  refreshCache,
} from "../controller/mysql/hsCodeController.js";

const router = express.Router();

// Get all HS codes with caching
router.get("/hs-codes", getHSCodes);

// Search HS codes
router.get("/hs-codes/search", searchHSCodes);

// Get cache status
router.get("/hs-codes/cache/status", getCacheStatus);

// Clear cache (admin only)
router.delete("/hs-codes/cache", clearCache);

// Refresh cache (force fetch from FBR)
router.post("/hs-codes/cache/refresh", refreshCache);

export default router;
