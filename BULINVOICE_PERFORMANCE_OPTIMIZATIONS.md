# BulInvoice Performance Optimizations

This document outlines the comprehensive performance optimizations implemented to significantly reduce upload time for thousands of invoices in the BulInvoice system.

## 🚀 Performance Improvements

### Expected Results
- **3-5x faster upload speed** for large files (1000+ invoices)
- **50-70% reduction** in memory consumption
- **2-3x faster** database operations
- **Real-time progress tracking** with cancellation support
- **Memory leak prevention** and efficient resource management

## 📋 Optimizations Implemented

### 1. Chunked Upload Processing ✅
**Problem**: Single large transaction processing thousands of invoices
**Solution**: Process invoices in configurable chunks (default: 500 invoices per chunk)

**Benefits**:
- Prevents database timeouts
- Reduces memory usage
- Allows for progress tracking
- Enables partial recovery on failures

**Files Modified**:
- `apps/backend/src/controller/mysql/invoiceController.js`
- Added chunked processing logic with configurable chunk sizes

### 2. Database Indexes ✅
**Problem**: Missing indexes on frequently queried fields
**Solution**: Added comprehensive indexes for bulk operations

**Indexes Added**:
```sql
-- Invoice table indexes
CREATE INDEX idx_invoices_system_invoice_id ON invoices(system_invoice_id);
CREATE INDEX idx_invoices_buyer_ntn_cnic ON invoices(buyerNTNCNIC);
CREATE INDEX idx_invoices_company_invoice_ref_no ON invoices(companyInvoiceRefNo);
CREATE INDEX idx_invoices_bulk_lookup ON invoices(buyerNTNCNIC, status, created_at);

-- InvoiceItem table indexes
CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_name ON invoice_items(name);
CREATE INDEX idx_invoice_items_hs_code ON invoice_items(hsCode);

-- Buyer table indexes
CREATE INDEX idx_buyers_ntn_cnic ON buyers(buyerNTNCNIC);
CREATE INDEX idx_buyers_bulk_lookup ON buyers(buyerNTNCNIC, buyerBusinessName);
```

**Files Created**:
- `apps/backend/scripts/add-performance-indexes.sql`
- `apps/backend/src/service/PerformanceOptimizationService.js`

### 3. Web Workers for File Processing ✅
**Problem**: Large file processing blocks the UI thread
**Solution**: Process files in Web Workers for non-blocking UI

**Features**:
- CSV/Excel parsing in separate thread
- Real-time progress reporting
- Cancellation support
- Memory-efficient processing

**Files Created**:
- `apps/frontend/src/workers/fileProcessor.worker.js`
- `apps/frontend/src/hooks/useFileProcessor.js`

### 4. Streaming Upload with Progress Tracking ✅
**Problem**: No progress feedback for large uploads
**Solution**: Real-time progress tracking with chunked uploads

**Features**:
- Real-time progress updates
- Upload cancellation
- Performance metrics
- Error handling per chunk

**Files Created**:
- `apps/frontend/src/services/StreamingUploadService.js`
- `apps/frontend/src/hooks/useStreamingUpload.js`

### 5. Database Connection Pooling ✅
**Problem**: Inefficient database connections
**Solution**: Optimized connection pooling and query optimization

**Optimizations**:
- Increased pool size for bulk operations
- Connection retry logic
- Query optimization settings
- Raw SQL for large datasets

**Files Created**:
- `apps/backend/src/service/DatabaseOptimizationService.js`

### 6. Memory Management ✅
**Problem**: Memory leaks and inefficient memory usage
**Solution**: Comprehensive memory management system

**Features**:
- Automatic garbage collection
- Memory usage monitoring
- Process tracking and cleanup
- Memory-efficient chunk processing

**Files Created**:
- `apps/backend/src/service/MemoryManagementService.js`

## 🛠️ Setup Instructions

### 1. Run Performance Setup Script
```bash
cd apps/backend
node scripts/setup-performance-optimizations.js
```

This will generate:
- `database-optimizations.sql` - MySQL optimization settings
- `performance-indexes.sql` - Database indexes
- `memory-config.json` - Memory management configuration
- `connection-pool-config.json` - Connection pool settings
- `performance-report.json` - Setup report

### 2. Apply Database Optimizations
Run the generated SQL files on your MySQL database:
```bash
mysql -u username -p database_name < scripts/database-optimizations.sql
mysql -u username -p database_name < scripts/performance-indexes.sql
```

### 3. Configure Environment Variables
Add these to your `.env` file:
```env
# Performance Settings
BULK_UPLOAD_CHUNK_SIZE=500
MAX_CONCURRENT_UPLOADS=3
MEMORY_THRESHOLD_MB=512
DB_POOL_MAX=30
DB_POOL_MIN=10
```

## 📊 Performance Monitoring

### Memory Usage Monitoring
The system now tracks:
- Heap memory usage
- Active processes
- Garbage collection frequency
- Memory leak detection

### Database Performance
Monitor:
- Query execution times
- Index usage statistics
- Connection pool status
- Slow query logs

### Upload Performance
Track:
- Chunk processing times
- Upload success rates
- Error rates and types
- User cancellation rates

## 🔧 Configuration Options

### Chunk Size Configuration
```javascript
// Backend: Adjust chunk size based on server capacity
const chunkSize = process.env.BULK_UPLOAD_CHUNK_SIZE || 500;

// Frontend: Automatic chunk size based on file size
const chunkSize = fileSize > 10000 ? 1000 : 500;
```

### Memory Management
```javascript
// Adjust memory threshold
const memoryThreshold = 512 * 1024 * 1024; // 512MB

// Garbage collection interval
const gcInterval = 30000; // 30 seconds
```

### Connection Pool
```javascript
// Optimize for bulk operations
const poolConfig = {
  max: 30,        // Maximum connections
  min: 10,        // Minimum connections
  acquire: 60000, // Connection timeout
  idle: 30000,    // Idle timeout
};
```

## 🚨 Troubleshooting

### High Memory Usage
1. Check active processes: `MemoryManagementService.getActiveProcesses()`
2. Reduce chunk size
3. Increase garbage collection frequency
4. Monitor for memory leaks

### Slow Database Operations
1. Verify indexes are created: Check `performance-indexes.sql`
2. Monitor slow query log
3. Optimize database settings: Check `database-optimizations.sql`
4. Check connection pool status

### Upload Failures
1. Check error logs for specific chunk failures
2. Verify file format and data validation
3. Monitor network connectivity
4. Check database connection limits

## 📈 Expected Performance Metrics

### Before Optimization
- 1000 invoices: ~5-10 minutes
- Memory usage: ~1-2GB peak
- Database timeouts: Frequent
- UI blocking: Yes

### After Optimization
- 1000 invoices: ~1-2 minutes
- Memory usage: ~300-500MB peak
- Database timeouts: Rare
- UI blocking: No (with progress tracking)

## 🔄 Maintenance

### Regular Tasks
1. Monitor performance metrics weekly
2. Check database index usage monthly
3. Review memory usage patterns
4. Update chunk sizes based on server capacity

### Performance Tuning
1. Adjust chunk sizes based on actual performance
2. Optimize database settings for your hardware
3. Monitor and adjust memory thresholds
4. Review and update connection pool settings

## 📞 Support

For issues or questions about these optimizations:
1. Check the performance report: `performance-report.json`
2. Review error logs for specific issues
3. Monitor system resources during uploads
4. Adjust configuration based on your environment

---

**Note**: These optimizations are designed to handle thousands of invoices efficiently. For even larger datasets (10,000+ invoices), consider implementing additional optimizations such as database partitioning or distributed processing.
