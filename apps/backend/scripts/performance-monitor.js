#!/usr/bin/env node

/**
 * 🚀 Performance Monitor for Invoice Uploads
 * 
 * This script monitors and reports on the performance improvements
 * achieved through the optimized bulk upload system.
 */

import { createTenantConnection } from '../src/config/mysql.js';
import dotenv from 'dotenv';

dotenv.config();

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      totalUploads: 0,
      totalInvoices: 0,
      averageTime: 0,
      fastestUpload: Infinity,
      slowestUpload: 0,
      uploadHistory: []
    };
  }

  async connectToDatabase(databaseName) {
    try {
      console.log(`🔌 Connecting to database: ${databaseName}`);
      const sequelize = createTenantConnection(databaseName);
      await sequelize.authenticate();
      console.log(`✅ Connected to ${databaseName}`);
      return sequelize;
    } catch (error) {
      console.error(`❌ Failed to connect to ${databaseName}:`, error.message);
      return null;
    }
  }

  async getUploadPerformance(sequelize) {
    try {
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
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        ORDER BY created_at DESC
        LIMIT 100
      `);

      // Calculate performance metrics
      const totalUploads = recentUploads.length;
      if (totalUploads === 0) {
        console.log('📊 No recent uploads found in the last 24 hours');
        return;
      }

      const totalInvoices = recentUploads.length;
      const avgProcessingTime = recentUploads.reduce((sum, upload) => 
        sum + (upload.processing_time_microseconds || 0), 0
      ) / totalUploads;

      const fastUploads = recentUploads.filter(upload => 
        (upload.processing_time_microseconds || 0) < 1000000
      ).length; // < 1 second

      const slowUploads = recentUploads.filter(upload => 
        (upload.processing_time_microseconds || 0) > 5000000
      ).length; // > 5 seconds

      const fastestUpload = Math.min(...recentUploads.map(u => u.processing_time_microseconds || 0));
      const slowestUpload = Math.max(...recentUploads.map(u => u.processing_time_microseconds || 0));

      // Update metrics
      this.metrics.totalUploads = totalUploads;
      this.metrics.totalInvoices = totalInvoices;
      this.metrics.averageTime = avgProcessingTime;
      this.metrics.fastestUpload = Math.min(this.metrics.fastestUpload, fastestUpload);
      this.metrics.slowestUpload = Math.max(this.metrics.slowestUpload, slowestUpload);

      // Display performance report
      console.log('\n📊 PERFORMANCE REPORT (Last 24 Hours)');
      console.log('=====================================');
      console.log(`📈 Total Uploads: ${totalUploads}`);
      console.log(`📄 Total Invoices: ${totalInvoices}`);
      console.log(`⚡ Average Processing Time: ${(avgProcessingTime / 1000).toFixed(2)}ms`);
      console.log(`🚀 Fastest Upload: ${(fastestUpload / 1000).toFixed(2)}ms`);
      console.log(`🐌 Slowest Upload: ${(slowestUpload / 1000).toFixed(2)}ms`);
      console.log(`✅ Fast Uploads (<1s): ${fastUploads} (${((fastUploads / totalUploads) * 100).toFixed(1)}%)`);
      console.log(`❌ Slow Uploads (>5s): ${slowUploads} (${((slowUploads / totalUploads) * 100).toFixed(1)}%)`);
      
      // Performance rating
      const performanceScore = this.calculatePerformanceScore(avgProcessingTime, fastUploads, totalUploads);
      console.log(`🏆 Performance Score: ${performanceScore}/100`);

      // Recommendations
      this.provideRecommendations(avgProcessingTime, fastUploads, totalUploads);

    } catch (error) {
      console.error('❌ Error getting upload performance:', error.message);
    }
  }

  calculatePerformanceScore(avgTime, fastUploads, totalUploads) {
    let score = 100;
    
    // Time penalty
    if (avgTime > 5000000) score -= 30;      // >5s average
    else if (avgTime > 1000000) score -= 20; // >1s average
    else if (avgTime > 500000) score -= 10;  // >500ms average
    
    // Fast upload bonus
    const fastPercentage = (fastUploads / totalUploads) * 100;
    if (fastPercentage >= 90) score += 10;
    else if (fastPercentage >= 80) score += 5;
    else if (fastPercentage < 50) score -= 20;
    
    return Math.max(0, Math.min(100, score));
  }

  provideRecommendations(avgTime, fastUploads, totalUploads) {
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('===================');
    
    if (avgTime > 5000000) {
      console.log('🔴 CRITICAL: Average upload time is very slow (>5s)');
      console.log('   - Check database indexes on invoices table');
      console.log('   - Verify database connection pool settings');
      console.log('   - Consider running the buyer optimization scripts');
    } else if (avgTime > 1000000) {
      console.log('🟡 WARNING: Average upload time is slow (>1s)');
      console.log('   - Run: npm run optimize-buyers-simple');
      console.log('   - Check for database bottlenecks');
    } else if (avgTime > 500000) {
      console.log('🟠 NOTICE: Upload time could be improved (>500ms)');
      console.log('   - Consider running optimization scripts');
    } else {
      console.log('🟢 EXCELLENT: Upload performance is optimal (<500ms)');
    }

    const fastPercentage = (fastUploads / totalUploads) * 100;
    if (fastPercentage < 80) {
      console.log('📉 Many uploads are taking longer than expected');
      console.log('   - Run: npm run optimize-buyers-simple');
      console.log('   - Check database performance');
    }
  }

  async getDatabaseStats(sequelize) {
    try {
      console.log('\n🗄️ DATABASE STATISTICS');
      console.log('=====================');
      
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
        ORDER BY table_name
      `);

      tableStats.forEach(table => {
        console.log(`${table.table_name}:`);
        console.log(`  - Rows: ${table.table_rows?.toLocaleString() || 'N/A'}`);
        console.log(`  - Size: ${table.Size_MB} MB`);
        console.log(`  - Data: ${(table.data_length / 1024 / 1024).toFixed(2)} MB`);
        console.log(`  - Indexes: ${(table.index_length / 1024 / 1024).toFixed(2)} MB`);
      });

      // Check for missing indexes
      await this.checkMissingIndexes(sequelize);

    } catch (error) {
      console.error('❌ Error getting database stats:', error.message);
    }
  }

  async checkMissingIndexes(sequelize) {
    try {
      console.log('\n🔍 INDEX ANALYSIS');
      console.log('=================');
      
      // Check invoices table indexes
      const [invoiceIndexes] = await sequelize.query(`
        SHOW INDEX FROM invoices
      `);
      
      const hasBuyerIndex = invoiceIndexes.some(idx => 
        idx.Column_name === 'buyerNTNCNIC' || idx.Column_name === 'buyer_business_name'
      );
      
      if (!hasBuyerIndex) {
        console.log('⚠️  Missing buyer indexes on invoices table');
        console.log('   Run: npm run optimize-buyers-simple');
      } else {
        console.log('✅ Buyer indexes found on invoices table');
      }

      // Check buyers table indexes
      const [buyerIndexes] = await sequelize.query(`
        SHOW INDEX FROM buyers
      `);
      
      const hasBuyerNTNIndex = buyerIndexes.some(idx => 
        idx.Column_name === 'buyerNTNCNIC' && idx.Key_name !== 'PRIMARY'
      );
      
      if (!hasBuyerNTNIndex) {
        console.log('⚠️  Missing buyerNTNCNIC index on buyers table');
        console.log('   Run: npm run optimize-buyers-simple');
      } else {
        console.log('✅ buyerNTNCNIC index found on buyers table');
      }

    } catch (error) {
      console.error('❌ Error checking indexes:', error.message);
    }
  }

  async runPerformanceTest(sequelize) {
    try {
      console.log('\n🧪 PERFORMANCE TEST');
      console.log('===================');
      
      const startTime = process.hrtime.bigint();
      
      // Simulate a bulk upload query
      const [result] = await sequelize.query(`
        SELECT COUNT(*) as total_invoices,
               COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_count,
               COUNT(CASE WHEN status = 'posted' THEN 1 END) as posted_count
        FROM invoices
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
      `);
      
      const endTime = process.hrtime.bigint();
      const queryTime = Number(endTime - startTime) / 1000000;
      
      console.log(`⚡ Query execution time: ${queryTime.toFixed(2)}ms`);
      console.log(`📊 Results: ${JSON.stringify(result[0], null, 2)}`);
      
      if (queryTime > 100) {
        console.log('⚠️  Query is taking longer than expected (>100ms)');
        console.log('   Consider adding database indexes');
      } else {
        console.log('✅ Query performance is optimal');
      }
      
    } catch (error) {
      console.error('❌ Error running performance test:', error.message);
    }
  }

  async monitor(databaseName) {
    console.log('🚀 Starting Performance Monitor...\n');
    
    const sequelize = await this.connectToDatabase(databaseName);
    if (!sequelize) {
      console.log('❌ Cannot proceed without database connection');
      return;
    }

    try {
      await this.getUploadPerformance(sequelize);
      await this.getDatabaseStats(sequelize);
      await this.runPerformanceTest(sequelize);
      
      console.log('\n🎯 NEXT STEPS:');
      console.log('===============');
      console.log('1. If performance is poor, run: npm run optimize-buyers-simple');
      console.log('2. Monitor upload times after optimization');
      console.log('3. Run this script again to see improvements');
      console.log('4. For advanced optimization, run: npm run optimize-buyers');
      
    } catch (error) {
      console.error('❌ Error during monitoring:', error.message);
    } finally {
      await sequelize.close();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Main execution
const main = async () => {
  const databaseName = process.argv[2];
  
  if (!databaseName) {
    console.log('❌ Usage: node performance-monitor.js <database_name>');
    console.log('Example: node performance-monitor.js tenant_abc123');
    process.exit(1);
  }

  const monitor = new PerformanceMonitor();
  await monitor.monitor(databaseName);
};

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

// Run the monitor
main().catch(console.error);
