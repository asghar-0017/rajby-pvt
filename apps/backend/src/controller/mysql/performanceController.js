// Performance monitoring controller for invoice uploads
export const getPerformanceMetrics = async (req, res) => {
  try {
    const { Invoice, InvoiceItem } = req.tenantModels;
    const sequelize = req.tenantDb;

    // Get database performance stats
    const [dbStats] = await sequelize.query(`
      SELECT 
        COUNT(*) as total_invoices,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_invoices,
        COUNT(CASE WHEN status = 'posted' THEN 1 END) as posted_invoices,
        AVG(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) as invoices_last_24h,
        MAX(created_at) as last_upload_time
      FROM invoices
    `);

    // Get upload performance over time
    const [hourlyStats] = await sequelize.query(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00') as hour,
        COUNT(*) as invoice_count,
        AVG(TIMESTAMPDIFF(MICROSECOND, created_at, updated_at)) as avg_processing_time_microseconds
      FROM invoices 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY hour
      ORDER BY hour DESC
      LIMIT 24
    `);

    // Get table sizes and index usage
    const [tableStats] = await sequelize.query(`
      SELECT 
        table_name,
        table_rows,
        data_length,
        index_length,
        ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size_MB'
      FROM information_schema.tables 
      WHERE table_schema = DATABASE()
      AND table_name IN ('invoices', 'invoice_items', 'buyers')
    `);

    // Calculate performance metrics
    const totalInvoices = dbStats[0]?.total_invoices || 0;
    const draftInvoices = dbStats[0]?.draft_invoices || 0;
    const postedInvoices = dbStats[0]?.posted_invoices || 0;
    const invoicesLast24h = dbStats[0]?.invoices_last_24h || 0;
    const lastUploadTime = dbStats[0]?.last_upload_time;

    // Calculate average processing time
    const avgProcessingTime =
      hourlyStats.reduce(
        (sum, stat) => sum + (stat.avg_processing_time_microseconds || 0),
        0
      ) / Math.max(hourlyStats.length, 1);

    // Performance recommendations
    const recommendations = [];

    if (avgProcessingTime > 1000000) {
      // > 1 second
      recommendations.push({
        type: "warning",
        message:
          "Average processing time is high. Consider optimizing database indexes.",
        priority: "high",
      });
    }

    if (draftInvoices > totalInvoices * 0.8) {
      recommendations.push({
        type: "info",
        message:
          "High percentage of draft invoices. Consider batch processing.",
        priority: "medium",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalInvoices,
          draftInvoices,
          postedInvoices,
          invoicesLast24h,
          lastUploadTime,
        },
        performance: {
          avgProcessingTimeMicroseconds: Math.round(avgProcessingTime),
          avgProcessingTimeMs: (avgProcessingTime / 1000).toFixed(2),
          hourlyStats,
        },
        database: {
          tableStats,
          recommendations,
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error getting performance metrics:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving performance metrics",
      error: error.message,
    });
  }
};

// Get real-time upload performance
export const getUploadPerformance = async (req, res) => {
  try {
    const { Invoice } = req.tenantModels;
    const sequelize = req.tenantDb;

    // Get recent uploads with timing
    const [recentUploads] = await sequelize.query(`
      SELECT 
        id,
        invoice_number,
        status,
        created_at,
        updated_at,
        TIMESTAMPDIFF(MICROSECOND, created_at, updated_at) as processing_time_microseconds
      FROM invoices 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
      ORDER BY created_at DESC
      LIMIT 100
    `);

    // Calculate performance metrics
    const totalUploads = recentUploads.length;
    const avgProcessingTime =
      recentUploads.reduce(
        (sum, upload) => sum + (upload.processing_time_microseconds || 0),
        0
      ) / Math.max(totalUploads, 1);

    const fastUploads = recentUploads.filter(
      (upload) => (upload.processing_time_microseconds || 0) < 1000000
    ).length; // < 1 second

    const slowUploads = recentUploads.filter(
      (upload) => (upload.processing_time_microseconds || 0) > 5000000
    ).length; // > 5 seconds

    res.status(200).json({
      success: true,
      data: {
        recentUploads: totalUploads,
        performance: {
          avgProcessingTimeMicroseconds: Math.round(avgProcessingTime),
          avgProcessingTimeMs: (avgProcessingTime / 1000).toFixed(2),
          fastUploads,
          slowUploads,
          fastUploadPercentage:
            totalUploads > 0
              ? ((fastUploads / totalUploads) * 100).toFixed(1)
              : 0,
        },
        uploads: recentUploads.slice(0, 20), // Return first 20 for detailed view
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error getting upload performance:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving upload performance",
      error: error.message,
    });
  }
};

// Get database optimization recommendations
export const getOptimizationRecommendations = async (req, res) => {
  try {
    const sequelize = req.tenantDb;

    // Check for missing indexes
    const [missingIndexes] = await sequelize.query(`
      SELECT 
        t.table_name,
        c.column_name,
        c.data_type,
        c.character_maximum_length
      FROM information_schema.tables t
      JOIN information_schema.columns c ON t.table_name = c.table_name
      WHERE t.table_schema = DATABASE()
      AND t.table_name IN ('invoices', 'invoice_items', 'buyers')
      AND c.column_name IN ('buyerNTNCNIC', 'sellerNTNCNIC', 'invoice_number', 'system_invoice_id', 'invoice_id')
      AND NOT EXISTS (
        SELECT 1 FROM information_schema.statistics s
        WHERE s.table_schema = DATABASE()
        AND s.table_name = t.table_name
        AND s.column_name = c.column_name
      )
    `);

    // Check for slow queries
    const [slowQueries] = await sequelize.query(`
      SELECT 
        sql_text,
        exec_count,
        avg_timer_wait / 1000000000 as avg_time_seconds,
        max_timer_wait / 1000000000 as max_time_seconds
      FROM performance_schema.events_statements_summary_by_digest
      WHERE avg_timer_wait > 1000000000
      ORDER BY avg_timer_wait DESC
      LIMIT 10
    `);

    // Generate recommendations
    const recommendations = [];

    if (missingIndexes.length > 0) {
      recommendations.push({
        type: "critical",
        message: `Missing indexes on ${missingIndexes.length} columns. This will significantly impact upload performance.`,
        details: missingIndexes.map(
          (idx) => `${idx.table_name}.${idx.column_name}`
        ),
        priority: "critical",
        action: "Run ultra-fast optimization script",
      });
    }

    if (slowQueries.length > 0) {
      recommendations.push({
        type: "warning",
        message: `${slowQueries.length} slow queries detected. Consider query optimization.`,
        details: slowQueries.map(
          (q) =>
            `${q.sql_text?.substring(0, 100)}... (${q.avg_time_seconds.toFixed(2)}s avg)`
        ),
        priority: "high",
        action: "Review and optimize slow queries",
      });
    }

    // Check database configuration
    const [dbConfig] = await sequelize.query(`
      SHOW VARIABLES LIKE 'innodb_buffer_pool_size'
    `);

    const bufferPoolSize =
      parseInt(dbConfig[0]?.Value || "0") / (1024 * 1024 * 1024); // Convert to GB

    if (bufferPoolSize < 1) {
      recommendations.push({
        type: "info",
        message:
          "InnoDB buffer pool size is less than 1GB. Consider increasing for better bulk upload performance.",
        details: `Current: ${bufferPoolSize.toFixed(2)}GB, Recommended: 1-4GB`,
        priority: "medium",
        action: "Increase innodb_buffer_pool_size",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        recommendations,
        missingIndexes: missingIndexes.length,
        slowQueries: slowQueries.length,
        databaseConfig: {
          bufferPoolSizeGB: bufferPoolSize.toFixed(2),
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error getting optimization recommendations:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving optimization recommendations",
      error: error.message,
    });
  }
};
