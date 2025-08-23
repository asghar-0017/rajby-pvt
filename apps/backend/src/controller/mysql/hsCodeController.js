import hsCodeCacheService from "../../service/HSCodeCacheService.js";

// Get all HS codes with caching
export const getHSCodes = async (req, res) => {
  try {
    const { environment = "sandbox", forceRefresh = false } = req.query;

    // Get token from request headers
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authorization token required",
      });
    }

    console.log(
      `Fetching HS codes for environment: ${environment}, forceRefresh: ${forceRefresh}`
    );

    const startTime = Date.now();
    const hsCodes = await hsCodeCacheService.getHSCodes(
      environment,
      token,
      forceRefresh === "true"
    );
    const duration = Date.now() - startTime;

    res.json({
      success: true,
      data: hsCodes,
      cacheInfo: {
        ...hsCodeCacheService.getCacheStatus(),
        responseTime: `${duration}ms`,
      },
    });
  } catch (error) {
    console.error("Error fetching HS codes:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch HS codes",
      error: error.message,
    });
  }
};

// Search HS codes
export const searchHSCodes = async (req, res) => {
  try {
    const { q: searchTerm, limit = 50 } = req.query;

    if (!searchTerm || searchTerm.trim().length < 2) {
      return res.json({
        success: true,
        data: [],
        message: "Search term must be at least 2 characters long",
      });
    }

    console.log(`Searching HS codes for: "${searchTerm}", limit: ${limit}`);

    const startTime = Date.now();
    const results = hsCodeCacheService.searchHSCodes(
      searchTerm,
      parseInt(limit)
    );
    const duration = Date.now() - startTime;

    res.json({
      success: true,
      data: results,
      searchInfo: {
        searchTerm,
        resultCount: results.length,
        responseTime: `${duration}ms`,
      },
    });
  } catch (error) {
    console.error("Error searching HS codes:", error);
    res.status(500).json({
      success: false,
      message: "Failed to search HS codes",
      error: error.message,
    });
  }
};

// Get cache status
export const getCacheStatus = async (req, res) => {
  try {
    const status = hsCodeCacheService.getCacheStatus();

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error("Error getting cache status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get cache status",
      error: error.message,
    });
  }
};

// Clear cache
export const clearCache = async (req, res) => {
  try {
    hsCodeCacheService.clearCache();

    res.json({
      success: true,
      message: "HS Code cache cleared successfully",
    });
  } catch (error) {
    console.error("Error clearing cache:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clear cache",
      error: error.message,
    });
  }
};

// Refresh cache (force fetch from FBR)
export const refreshCache = async (req, res) => {
  try {
    const { environment = "sandbox" } = req.query;

    // Get token from request headers
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authorization token required",
      });
    }

    console.log(`Refreshing HS code cache for environment: ${environment}`);

    const startTime = Date.now();
    const hsCodes = await hsCodeCacheService.getHSCodes(
      environment,
      token,
      true
    );
    const duration = Date.now() - startTime;

    res.json({
      success: true,
      message: "HS Code cache refreshed successfully",
      data: {
        count: hsCodes.length,
        responseTime: `${duration}ms`,
      },
      cacheInfo: hsCodeCacheService.getCacheStatus(),
    });
  } catch (error) {
    console.error("Error refreshing cache:", error);
    res.status(500).json({
      success: false,
      message: "Failed to refresh cache",
      error: error.message,
    });
  }
};
