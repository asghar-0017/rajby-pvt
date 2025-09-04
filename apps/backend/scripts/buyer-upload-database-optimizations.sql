-- Buyer Upload Database Performance Optimizations - ULTRA AGGRESSIVE VERSION
-- Run these commands on your MySQL database for MAXIMUM bulk upload performance

-- ============================================================================
-- INNODB ULTRA-OPTIMIZED SETTINGS FOR BULK OPERATIONS
-- ============================================================================

-- Increase buffer pool size for maximum performance (adjust based on your server RAM)
SET GLOBAL innodb_buffer_pool_size = 2147483648; -- 2GB (increase if you have more RAM)
SET GLOBAL innodb_buffer_pool_instances = 8; -- Multiple instances for better concurrency
SET GLOBAL innodb_buffer_pool_chunk_size = 134217728; -- 128MB chunks

-- Optimize log files for bulk operations
SET GLOBAL innodb_log_file_size = 536870912; -- 512MB (doubled from previous)
SET GLOBAL innodb_log_buffer_size = 134217728; -- 128MB (doubled from previous)
SET GLOBAL innodb_log_files_in_group = 4; -- Multiple log files
SET GLOBAL innodb_flush_log_at_trx_commit = 0; -- Maximum performance (less durability)
SET GLOBAL innodb_flush_method = O_DIRECT; -- Direct I/O for better performance
SET GLOBAL innodb_doublewrite = 0; -- Disable doublewrite for bulk operations

-- Optimize for bulk inserts
SET GLOBAL bulk_insert_buffer_size = 536870912; -- 512MB (doubled from previous)
SET GLOBAL myisam_sort_buffer_size = 268435456; -- 256MB (doubled from previous)
SET GLOBAL key_buffer_size = 536870912; -- 512MB (doubled from previous)

-- ============================================================================
-- QUERY CACHE AND PERFORMANCE OPTIMIZATIONS
-- ============================================================================

-- Maximize query cache
SET GLOBAL query_cache_size = 268435456; -- 256MB (doubled from previous)
SET GLOBAL query_cache_type = 1;
SET GLOBAL query_cache_limit = 2097152; -- 2MB per query
SET GLOBAL query_cache_min_res_unit = 512; -- Smaller units for better efficiency

-- ============================================================================
-- CONNECTION AND POOL OPTIMIZATIONS
-- ============================================================================

-- Increase connection limits for bulk operations
SET GLOBAL max_connections = 500; -- Doubled from previous
SET GLOBAL max_connect_errors = 1000000;
SET GLOBAL connect_timeout = 120; -- Increased timeout
SET GLOBAL wait_timeout = 28800;
SET GLOBAL interactive_timeout = 28800;
SET GLOBAL net_read_timeout = 120;
SET GLOBAL net_write_timeout = 120;

-- ============================================================================
-- TABLE AND INDEX OPTIMIZATIONS
-- ============================================================================

-- Optimize table cache
SET GLOBAL table_open_cache = 8000; -- Doubled from previous
SET GLOBAL table_definition_cache = 4000; -- Doubled from previous
SET GLOBAL table_open_cache_instances = 16; -- Multiple instances

-- ============================================================================
-- SORT AND JOIN OPERATIONS
-- ============================================================================

-- Optimize sort and join operations for bulk processing
SET GLOBAL sort_buffer_size = 8388608; -- 8MB (quadrupled from previous)
SET GLOBAL join_buffer_size = 8388608; -- 8MB (quadrupled from previous)
SET GLOBAL read_buffer_size = 262144; -- 256KB (doubled from previous)
SET GLOBAL read_rnd_buffer_size = 524288; -- 512KB (doubled from previous)

-- ============================================================================
-- TEMPORARY TABLE OPTIMIZATIONS
-- ============================================================================

-- Optimize temporary tables for bulk operations
SET GLOBAL tmp_table_size = 268435456; -- 256MB (doubled from previous)
SET GLOBAL max_heap_table_size = 268435456; -- 256MB (doubled from previous)

-- ============================================================================
-- THREAD AND CONCURRENCY OPTIMIZATIONS
-- ============================================================================

-- Optimize for concurrent operations
SET GLOBAL thread_cache_size = 100; -- Cache more threads
SET GLOBAL thread_handling = pool-of-threads; -- Use thread pool if available
SET GLOBAL thread_pool_size = 32; -- Thread pool size

-- ============================================================================
-- BULK INSERT SPECIFIC OPTIMIZATIONS
-- ============================================================================

-- Optimize specifically for bulk inserts
SET GLOBAL innodb_autoinc_lock_mode = 2; -- Interleaved mode for bulk inserts
SET GLOBAL innodb_rollback_on_timeout = 0; -- Don't rollback on timeout
SET GLOBAL innodb_lock_wait_timeout = 120; -- Increase lock wait timeout
SET GLOBAL innodb_deadlock_detect = 0; -- Disable deadlock detection for bulk ops

-- ============================================================================
-- SHOW CURRENT SETTINGS
-- ============================================================================

-- Display current optimized settings
SHOW VARIABLES LIKE 'innodb_buffer_pool_size';
SHOW VARIABLES LIKE 'innodb_log_file_size';
SHOW VARIABLES LIKE 'max_connections';
SHOW VARIABLES LIKE 'query_cache_size';
SHOW VARIABLES LIKE 'sort_buffer_size';
SHOW VARIABLES LIKE 'join_buffer_size';
SHOW VARIABLES LIKE 'tmp_table_size';

-- ============================================================================
-- PERFORMANCE MONITORING
-- ============================================================================

-- Enable performance monitoring
SET GLOBAL performance_schema = ON;
SET GLOBAL performance_schema_max_table_instances = 10000;
SET GLOBAL performance_schema_max_table_handles = 10000;

-- Show current performance status
SHOW STATUS LIKE 'Innodb_buffer_pool_read_requests';
SHOW STATUS LIKE 'Innodb_buffer_pool_reads';
SHOW STATUS LIKE 'Innodb_buffer_pool_pages_data';
SHOW STATUS LIKE 'Innodb_buffer_pool_pages_free';

-- ============================================================================
-- WARNING: THESE SETTINGS ARE FOR MAXIMUM PERFORMANCE
-- ============================================================================
-- Note: Some settings reduce durability for maximum speed
-- Use only for bulk operations, not for critical production data
-- Consider reverting to safer settings after bulk operations complete
