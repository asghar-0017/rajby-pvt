import { DataTypes } from "sequelize";

/**
 * Performance Optimization Service for BulInvoice
 * Handles database optimizations, connection pooling, and performance monitoring
 */
class PerformanceOptimizationService {
  constructor() {
    this.connectionPool = new Map();
    this.performanceMetrics = {
      uploadTimes: [],
      chunkProcessingTimes: [],
      databaseQueryTimes: [],
    };
  }

  /**
   * Add performance indexes to database
   * @param {Object} sequelize - Sequelize instance
   * @param {string} databaseName - Database name
   */
  async addPerformanceIndexes(sequelize, databaseName) {
    try {
      console.log(`🔧 Adding performance indexes to database: ${databaseName}`);
      
      const indexes = [
        // Invoice table indexes
        'CREATE INDEX IF NOT EXISTS idx_invoices_system_invoice_id ON invoices(system_invoice_id)',
        'CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number)',
        'CREATE INDEX IF NOT EXISTS idx_invoices_buyer_ntn_cnic ON invoices(buyerNTNCNIC)',
        'CREATE INDEX IF NOT EXISTS idx_invoices_company_invoice_ref_no ON invoices(companyInvoiceRefNo)',
        'CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)',
        'CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at)',
        'CREATE INDEX IF NOT EXISTS idx_invoices_bulk_lookup ON invoices(buyerNTNCNIC, status, created_at)',
        
        // InvoiceItem table indexes
        'CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id)',
        'CREATE INDEX IF NOT EXISTS idx_invoice_items_name ON invoice_items(name)',
        'CREATE INDEX IF NOT EXISTS idx_invoice_items_hs_code ON invoice_items(hsCode)',
        'CREATE INDEX IF NOT EXISTS idx_invoice_items_created_at ON invoice_items(created_at)',
        
        // Buyer table indexes
        'CREATE INDEX IF NOT EXISTS idx_buyers_ntn_cnic ON buyers(buyerNTNCNIC)',
        'CREATE INDEX IF NOT EXISTS idx_buyers_business_name ON buyers(buyerBusinessName)',
        'CREATE INDEX IF NOT EXISTS idx_buyers_bulk_lookup ON buyers(buyerNTNCNIC, buyerBusinessName)',
      ];

      for (const indexQuery of indexes) {
        try {
          await sequelize.query(indexQuery);
          console.log(`✅ Index created: ${indexQuery.split(' ')[5]}`);
        } catch (error) {
          if (!error.message.includes('already exists')) {
            console.warn(`⚠️ Index creation warning: ${error.message}`);
          }
        }
      }

      console.log(`🎉 Performance indexes added successfully to ${databaseName}`);
      return true;
    } catch (error) {
      console.error(`❌ Error adding performance indexes: ${error.message}`);
      return false;
    }
  }

  /**
   * Optimize database connection pool settings
   * @param {Object} sequelize - Sequelize instance
   */
  async optimizeConnectionPool(sequelize) {
    try {
      const poolConfig = {
        max: 20, // Maximum number of connections
        min: 5,  // Minimum number of connections
        acquire: 30000, // Maximum time to get connection
        idle: 10000,    // Maximum idle time
        evict: 1000,    // Check for idle connections every 1 second
        handleDisconnects: true,
      };

      await sequelize.connectionManager.pool.destroy();
      sequelize.options.pool = poolConfig;
      
      console.log('🔧 Database connection pool optimized');
      return true;
    } catch (error) {
      console.error(`❌ Error optimizing connection pool: ${error.message}`);
      return false;
    }
  }

  /**
   * Monitor database performance
   * @param {Object} sequelize - Sequelize instance
   */
  async monitorDatabasePerformance(sequelize) {
    try {
      const [results] = await sequelize.query(`
        SELECT 
          TABLE_NAME,
          INDEX_NAME,
          CARDINALITY,
          INDEX_TYPE
        FROM information_schema.STATISTICS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME IN ('invoices', 'invoice_items', 'buyers')
        ORDER BY TABLE_NAME, CARDINALITY DESC
      `);

      console.log('📊 Database Performance Report:');
      console.table(results);

      // Check for slow queries
      const [slowQueries] = await sequelize.query(`
        SELECT 
          query_time,
          lock_time,
          rows_sent,
          rows_examined,
          sql_text
        FROM mysql.slow_log 
        WHERE start_time > DATE_SUB(NOW(), INTERVAL 1 HOUR)
        ORDER BY query_time DESC
        LIMIT 10
      `);

      if (slowQueries.length > 0) {
        console.warn('⚠️ Slow queries detected:');
        console.table(slowQueries);
      }

      return {
        indexes: results,
        slowQueries: slowQueries,
      };
    } catch (error) {
      console.error(`❌ Error monitoring database performance: ${error.message}`);
      return null;
    }
  }

  /**
   * Record performance metrics
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in milliseconds
   * @param {Object} metadata - Additional metadata
   */
  recordPerformanceMetric(operation, duration, metadata = {}) {
    const metric = {
      operation,
      duration,
      timestamp: new Date().toISOString(),
      metadata,
    };

    switch (operation) {
      case 'bulk_upload':
        this.performanceMetrics.uploadTimes.push(metric);
        break;
      case 'chunk_processing':
        this.performanceMetrics.chunkProcessingTimes.push(metric);
        break;
      case 'database_query':
        this.performanceMetrics.databaseQueryTimes.push(metric);
        break;
    }

    // Keep only last 100 metrics to prevent memory leaks
    if (this.performanceMetrics.uploadTimes.length > 100) {
      this.performanceMetrics.uploadTimes = this.performanceMetrics.uploadTimes.slice(-100);
    }
    if (this.performanceMetrics.chunkProcessingTimes.length > 100) {
      this.performanceMetrics.chunkProcessingTimes = this.performanceMetrics.chunkProcessingTimes.slice(-100);
    }
    if (this.performanceMetrics.databaseQueryTimes.length > 100) {
      this.performanceMetrics.databaseQueryTimes = this.performanceMetrics.databaseQueryTimes.slice(-100);
    }
  }

  /**
   * Get performance analytics
   */
  getPerformanceAnalytics() {
    const analytics = {
      uploadTimes: this.calculateStats(this.performanceMetrics.uploadTimes),
      chunkProcessingTimes: this.calculateStats(this.performanceMetrics.chunkProcessingTimes),
      databaseQueryTimes: this.calculateStats(this.performanceMetrics.databaseQueryTimes),
    };

    return analytics;
  }

  /**
   * Calculate statistics for performance metrics
   * @param {Array} metrics - Array of metric objects
   */
  calculateStats(metrics) {
    if (metrics.length === 0) return null;

    const durations = metrics.map(m => m.duration);
    const sorted = durations.sort((a, b) => a - b);

    return {
      count: metrics.length,
      average: durations.reduce((a, b) => a + b, 0) / durations.length,
      median: sorted[Math.floor(sorted.length / 2)],
      min: Math.min(...durations),
      max: Math.max(...durations),
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  /**
   * Optimize bulk insert operations
   * @param {Object} model - Sequelize model
   * @param {Array} data - Data to insert
   * @param {Object} options - Insert options
   */
  async optimizedBulkInsert(model, data, options = {}) {
    const startTime = process.hrtime.bigint();
    
    try {
      // Use optimized bulk insert options
      const optimizedOptions = {
        validate: false, // Skip validation for better performance
        ignoreDuplicates: true,
        benchmark: true,
        ...options,
      };

      const result = await model.bulkCreate(data, optimizedOptions);
      
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      this.recordPerformanceMetric('database_query', duration, {
        operation: 'bulk_insert',
        recordCount: data.length,
        modelName: model.name,
      });

      return result;
    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      console.error(`❌ Bulk insert failed after ${duration.toFixed(2)}ms:`, error);
      throw error;
    }
  }
}

export default new PerformanceOptimizationService();
