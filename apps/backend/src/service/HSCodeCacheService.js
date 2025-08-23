import { fetchData } from "./FBRService.js";
import { DataTypes } from "sequelize";

// In-memory cache for HS codes
let hsCodeCache = {
  data: null,
  timestamp: null,
  isLoading: false,
  loadingPromise: null,
};

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

class HSCodeCacheService {
  constructor() {
    this.cache = hsCodeCache;
  }

  // Check if cache is valid
  isCacheValid() {
    if (!this.cache.timestamp) return false;
    const now = Date.now();
    return now - this.cache.timestamp < CACHE_DURATION;
  }

  // Get HS codes with caching
  async getHSCodes(
    environment = "sandbox",
    token = null,
    forceRefresh = false
  ) {
    // If already loading, return the existing promise
    if (this.cache.isLoading && this.cache.loadingPromise) {
      console.log("HS Code fetch already in progress, waiting...");
      return this.cache.loadingPromise;
    }

    // Check if we have valid cache and don't need to force refresh
    if (!forceRefresh && this.isCacheValid()) {
      console.log("Using cached HS codes:", this.cache.data?.length || 0);
      return this.cache.data;
    }

    // Fetch fresh data
    this.cache.isLoading = true;
    this.cache.loadingPromise = this.fetchHSCodes(environment, token);

    try {
      const result = await this.cache.loadingPromise;
      return result;
    } finally {
      this.cache.isLoading = false;
      this.cache.loadingPromise = null;
    }
  }

  // Fetch HS codes from FBR API
  async fetchHSCodes(environment, token) {
    console.log("Fetching fresh HS codes from FBR API...");
    const startTime = Date.now();

    try {
      const data = await fetchData("pdi/v1/itemdesccode", environment, token);

      // Update cache
      this.cache.data = data;
      this.cache.timestamp = Date.now();

      const duration = Date.now() - startTime;
      console.log(
        `HS codes fetched successfully in ${duration}ms:`,
        data.length
      );

      return data;
    } catch (error) {
      console.error("Error fetching HS codes:", error);

      // If we have stale cache, return it as fallback
      if (this.cache.data && this.cache.data.length > 0) {
        console.log("Using stale cache as fallback");
        return this.cache.data;
      }

      throw error;
    }
  }

  // Search HS codes with optimization
  searchHSCodes(searchTerm, limit = 50) {
    if (!this.cache.data || !searchTerm) {
      return [];
    }

    const normalizedSearch = searchTerm.toLowerCase().trim();

    // If search term is too short, return empty to avoid overwhelming results
    if (normalizedSearch.length < 2) {
      return [];
    }

    const results = this.cache.data.filter((item) => {
      const codeMatch = item.hS_CODE.toLowerCase().includes(normalizedSearch);
      const descMatch =
        item.description &&
        item.description.toLowerCase().includes(normalizedSearch);
      return codeMatch || descMatch;
    });

    // Sort by relevance (exact matches first, then partial matches)
    results.sort((a, b) => {
      const aCodeExact = a.hS_CODE.toLowerCase().startsWith(normalizedSearch);
      const bCodeExact = b.hS_CODE.toLowerCase().startsWith(normalizedSearch);

      if (aCodeExact && !bCodeExact) return -1;
      if (!aCodeExact && bCodeExact) return 1;

      return 0;
    });

    return results.slice(0, limit);
  }

  // Clear cache
  clearCache() {
    this.cache.data = null;
    this.cache.timestamp = null;
    console.log("HS Code cache cleared");
  }

  // Get cache status
  getCacheStatus() {
    return {
      hasCache: !!this.cache.data,
      cacheSize: this.cache.data ? this.cache.data.length : 0,
      isValid: this.isCacheValid(),
      timestamp: this.cache.timestamp
        ? new Date(this.cache.timestamp).toLocaleString()
        : null,
      isLoading: this.cache.isLoading,
    };
  }

  // Create HS Code model for database caching (optional)
  createHSCodeModel(sequelize) {
    return sequelize.define(
      "HSCode",
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        hsCode: {
          type: DataTypes.STRING(50),
          allowNull: false,
          unique: true,
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        lastUpdated: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
      },
      {
        tableName: "hs_codes",
        timestamps: true,
      }
    );
  }
}

// Create singleton instance
const hsCodeCacheService = new HSCodeCacheService();

export default hsCodeCacheService;
