import { DataTypes } from "sequelize";

/**
 * Database Optimization Service for BulInvoice
 * Handles connection pooling, query optimization, and performance monitoring
 */
class DatabaseOptimizationService {
  constructor() {
    this.connectionPools = new Map();
    this.queryCache = new Map();
    this.performanceMetrics = new Map();
  }

  /**
   * Optimize database connection pool for bulk operations
   * @param {Object} sequelize - Sequelize instance
   * @param {Object} options - Pool configuration options
   */
  async optimizeConnectionPool(sequelize, options = {}) {
    try {
      const defaultConfig = {
        max: 30, // Maximum number of connections
        min: 10,  // Minimum number of connections
        acquire: 60000, // Maximum time to get connection (60 seconds)
        idle: 30000,    // Maximum idle time (30 seconds)
        evict: 1000,    // Check for idle connections every 1 second
        handleDisconnects: true,
        retry: {
          max: 3,
          match: [
            /ETIMEDOUT/,
            /EHOSTUNREACH/,
            /ECONNRESET/,
            /ECONNREFUSED/,
            /ETIMEDOUT/,
            /ESOCKETTIMEDOUT/,
            /EHOSTUNREACH/,
            /EPIPE/,
            /EAI_AGAIN/,
            /SequelizeConnectionError/,
            /SequelizeConnectionRefusedError/,
            /SequelizeHostNotFoundError/,
            /SequelizeHostNotReachableError/,
            /SequelizeInvalidConnectionError/,
            /SequelizeConnectionTimedOutError/
          ]
        }
      };

      const poolConfig = { ...defaultConfig, ...options };

      // Close existing pool if it exists
      if (sequelize.connectionManager.pool) {
        await sequelize.connectionManager.pool.destroy();
      }

      // Apply new pool configuration
      sequelize.options.pool = poolConfig;

      console.log('🔧 Database connection pool optimized:', poolConfig);
      return true;
    } catch (error) {
      console.error('❌ Error optimizing connection pool:', error);
      return false;
    }
  }

  /**
   * Optimize database queries for bulk operations
   * @param {Object} sequelize - Sequelize instance
   */
  async optimizeDatabaseQueries(sequelize) {
    try {
      console.log('🔧 Optimizing database queries...');

      // Set MySQL-specific optimizations (SESSION variables only)
      await sequelize.query('SET SESSION sql_mode = "STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO"');
      await sequelize.query('SET SESSION innodb_lock_wait_timeout = 50');
      await sequelize.query('SET SESSION lock_wait_timeout = 50');
      await sequelize.query('SET SESSION wait_timeout = 28800');
      await sequelize.query('SET SESSION interactive_timeout = 28800');
      
      // Optimize for bulk operations (SESSION variables only)
      await sequelize.query('SET SESSION bulk_insert_buffer_size = 256*1024*1024'); // 256MB
      await sequelize.query('SET SESSION myisam_sort_buffer_size = 128*1024*1024'); // 128MB
      
      // Note: key_buffer_size is a GLOBAL variable and requires SUPER privilege
      // We'll skip it to avoid permission errors
      
      // Note: autocommit should not be changed during transactions
      // We'll skip it to avoid transaction conflicts
      
      // Optimize InnoDB settings (SESSION variables only)
      await sequelize.query('SET SESSION innodb_flush_log_at_trx_commit = 2');
      
      // Note: innodb_buffer_pool_size is a GLOBAL variable and requires SUPER privilege
      // We'll skip it to avoid permission errors
      
      console.log('✅ Database queries optimized for bulk operations');
      return true;
    } catch (error) {
      console.error('❌ Error optimizing database queries:', error);
      return false;
    }
  }

  /**
   * Create optimized indexes for bulk operations
   * @param {Object} sequelize - Sequelize instance
   */
  async createOptimizedIndexes(sequelize) {
    try {
      console.log('🔧 Creating optimized indexes...');

      const indexes = [
        // Invoice table indexes (MySQL syntax - check if exists first)
        'CREATE INDEX idx_invoices_bulk_upload ON invoices(buyerNTNCNIC, status, created_at)',
        'CREATE INDEX idx_invoices_system_id_lookup ON invoices(system_invoice_id)',
        'CREATE INDEX idx_invoices_company_ref ON invoices(companyInvoiceRefNo)',
        'CREATE INDEX idx_invoices_buyer_lookup ON invoices(buyerNTNCNIC, buyerBusinessName)',
        
        // InvoiceItem table indexes
        'CREATE INDEX idx_invoice_items_bulk ON invoice_items(invoice_id, name)',
        'CREATE INDEX idx_invoice_items_hs_code ON invoice_items(hsCode)',
        'CREATE INDEX idx_invoice_items_product ON invoice_items(name, hsCode)',
        
        // Buyer table indexes
        'CREATE INDEX idx_buyers_bulk_lookup ON buyers(buyerNTNCNIC, buyerBusinessName)',
        'CREATE INDEX idx_buyers_province ON buyers(buyerProvince)',
        
        // Composite indexes for common queries
        'CREATE INDEX idx_invoices_status_date ON invoices(status, created_at)',
        'CREATE INDEX idx_invoices_tenant_status ON invoices(tenant_id, status)',
      ];

      for (const indexQuery of indexes) {
        try {
          // Check if index already exists before creating
          const indexName = indexQuery.split(' ')[2];
          const tableName = indexQuery.split(' ')[4];
          
          const [existingIndexes] = await sequelize.query(`
            SELECT INDEX_NAME 
            FROM information_schema.STATISTICS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = ? 
              AND INDEX_NAME = ?
          `, {
            replacements: [tableName, indexName]
          });

          if (existingIndexes.length === 0) {
            await sequelize.query(indexQuery);
            console.log(`✅ Index created: ${indexName}`);
          } else {
            console.log(`ℹ️ Index already exists: ${indexName}`);
          }
        } catch (error) {
          console.warn(`⚠️ Index creation warning: ${error.message}`);
        }
      }

      console.log('✅ Optimized indexes created successfully');
      return true;
    } catch (error) {
      console.error('❌ Error creating optimized indexes:', error);
      return false;
    }
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
      // Optimize bulk insert options
      const optimizedOptions = {
        validate: false, // Skip validation for better performance
        ignoreDuplicates: true,
        benchmark: true,
        logging: false, // Disable logging for bulk operations
        ...options,
      };

      // Use raw SQL for maximum performance on large datasets
      if (data.length > 1000) {
        return await this.rawBulkInsert(model, data, optimizedOptions);
      } else {
        return await model.bulkCreate(data, optimizedOptions);
      }
    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      console.error(`❌ Bulk insert failed after ${duration.toFixed(2)}ms:`, error);
      throw error;
    }
  }

  /**
   * Raw bulk insert for maximum performance
   * @param {Object} model - Sequelize model
   * @param {Array} data - Data to insert
   * @param {Object} options - Insert options
   */
  async rawBulkInsert(model, data, options = {}) {
    if (data.length === 0) return [];

    const tableName = model.getTableName();
    const attributes = Object.keys(data[0]);
    const values = data.map(row => 
      attributes.map(attr => {
        const value = row[attr];
        if (value === null || value === undefined) return 'NULL';
        if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
        if (typeof value === 'boolean') return value ? 1 : 0;
        return value;
      })
    );

    const columns = attributes.join(', ');
    const valueStrings = values.map(row => `(${row.join(', ')})`).join(',\n');

    const query = `
      INSERT INTO ${tableName} (${columns})
      VALUES ${valueStrings}
    `;

    try {
      const [results] = await model.sequelize.query(query, {
        transaction: options.transaction,
        logging: false,
      });

      // Return mock results for compatibility
      return data.map((_, index) => ({
        id: results.insertId + index,
        ...data[index],
      }));
    } catch (error) {
      console.error('Raw bulk insert failed:', error);
      throw error;
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
          INDEX_TYPE,
          COLUMN_NAME
        FROM information_schema.STATISTICS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME IN ('invoices', 'invoice_items', 'buyers')
        ORDER BY TABLE_NAME, CARDINALITY DESC
      `);

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

      // Get connection pool status
      const poolStatus = {
        total: sequelize.connectionManager.pool.size,
        used: sequelize.connectionManager.pool.used,
        waiting: sequelize.connectionManager.pool.pending,
        available: sequelize.connectionManager.pool.available,
      };

      const performanceReport = {
        indexes: results,
        slowQueries: slowQueries || [],
        poolStatus,
        timestamp: new Date().toISOString(),
      };

      console.log('📊 Database Performance Report:');
      console.log('Indexes:', results.length);
      console.log('Slow queries:', slowQueries?.length || 0);
      console.log('Pool status:', poolStatus);

      return performanceReport;
    } catch (error) {
      console.error('❌ Error monitoring database performance:', error);
      return null;
    }
  }

  /**
   * Optimize database for bulk operations
   * @param {Object} sequelize - Sequelize instance
   * @param {Object} options - Optimization options
   */
  async optimizeForBulkOperations(sequelize, options = {}) {
    try {
      console.log('🚀 Optimizing database for bulk operations...');

      const results = {
        connectionPool: false,
        queries: false,
        indexes: false,
        performance: null,
      };

      // Optimize connection pool
      results.connectionPool = await this.optimizeConnectionPool(sequelize, options.pool);

      // Optimize queries
      results.queries = await this.optimizeDatabaseQueries(sequelize);

      // Create indexes
      results.indexes = await this.createOptimizedIndexes(sequelize);

      // Monitor performance
      results.performance = await this.monitorDatabasePerformance(sequelize);

      console.log('✅ Database optimization completed:', results);
      return results;
    } catch (error) {
      console.error('❌ Database optimization failed:', error);
      throw error;
    }
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    try {
      // Clear query cache
      this.queryCache.clear();
      
      // Clear performance metrics
      this.performanceMetrics.clear();
      
      console.log('🧹 Database optimization service cleaned up');
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  }
}

export default new DatabaseOptimizationService();
