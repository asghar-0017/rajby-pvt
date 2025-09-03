import { EventEmitter } from 'events';

/**
 * Memory Management Service for BulInvoice
 * Handles memory-efficient data processing and prevents memory leaks
 */
class MemoryManagementService extends EventEmitter {
  constructor() {
    super();
    this.activeProcesses = new Map();
    this.memoryThreshold = 512 * 1024 * 1024; // 512MB threshold
    this.gcInterval = 30000; // 30 seconds
    this.maxProcessTime = 300000; // 5 minutes max process time
    
    // Start garbage collection monitoring
    this.startGarbageCollection();
  }

  /**
   * Start garbage collection monitoring
   */
  startGarbageCollection() {
    setInterval(() => {
      this.performGarbageCollection();
    }, this.gcInterval);
  }

  /**
   * Perform garbage collection
   */
  performGarbageCollection() {
    try {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Clean up completed processes
      this.cleanupCompletedProcesses();

      // Emit memory usage event
      const memoryUsage = process.memoryUsage();
      this.emit('memoryUsage', memoryUsage);

      // Check if memory usage is high
      if (memoryUsage.heapUsed > this.memoryThreshold) {
        this.emit('highMemoryUsage', memoryUsage);
        console.warn('⚠️ High memory usage detected:', {
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
          external: Math.round(memoryUsage.external / 1024 / 1024) + 'MB',
        });
      }
    } catch (error) {
      console.error('❌ Error during garbage collection:', error);
    }
  }

  /**
   * Clean up completed processes
   */
  cleanupCompletedProcesses() {
    const now = Date.now();
    for (const [processId, process] of this.activeProcesses.entries()) {
      if (process.completed || (now - process.startTime) > this.maxProcessTime) {
        this.activeProcesses.delete(processId);
        console.log(`🧹 Cleaned up process: ${processId}`);
      }
    }
  }

  /**
   * Register a new process for memory tracking
   * @param {string} processId - Unique process identifier
   * @param {Object} metadata - Process metadata
   */
  registerProcess(processId, metadata = {}) {
    this.activeProcesses.set(processId, {
      startTime: Date.now(),
      completed: false,
      metadata,
      memorySnapshots: [],
    });

    console.log(`📝 Registered process: ${processId}`, metadata);
  }

  /**
   * Complete a process
   * @param {string} processId - Process identifier
   */
  completeProcess(processId) {
    const process = this.activeProcesses.get(processId);
    if (process) {
      process.completed = true;
      process.endTime = Date.now();
      process.duration = process.endTime - process.startTime;
      
      console.log(`✅ Completed process: ${processId} (${process.duration}ms)`);
    }
  }

  /**
   * Process data in memory-efficient chunks
   * @param {Array} data - Data to process
   * @param {Function} processor - Processing function
   * @param {Object} options - Processing options
   */
  async processInChunks(data, processor, options = {}) {
    const {
      chunkSize = 1000,
      processId = `process_${Date.now()}`,
      onProgress = () => {},
      onChunkComplete = () => {},
      maxConcurrency = 3,
    } = options;

    this.registerProcess(processId, {
      totalItems: data.length,
      chunkSize,
      maxConcurrency,
    });

    try {
      const results = [];
      const chunks = this.createChunks(data, chunkSize);
      
      console.log(`🔄 Processing ${data.length} items in ${chunks.length} chunks`);

      // Process chunks with controlled concurrency
      for (let i = 0; i < chunks.length; i += maxConcurrency) {
        const batch = chunks.slice(i, i + maxConcurrency);
        
        const batchPromises = batch.map(async (chunk, batchIndex) => {
          const chunkIndex = i + batchIndex;
          const startTime = Date.now();
          
          try {
            const chunkResult = await processor(chunk, chunkIndex);
            
            const duration = Date.now() - startTime;
            onChunkComplete({
              chunkIndex,
              chunkSize: chunk.length,
              duration,
              result: chunkResult,
            });

            return chunkResult;
          } catch (error) {
            console.error(`❌ Chunk ${chunkIndex} processing failed:`, error);
            throw error;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Report progress
        const processedItems = Math.min((i + maxConcurrency) * chunkSize, data.length);
        const progress = (processedItems / data.length) * 100;
        onProgress({
          processedItems,
          totalItems: data.length,
          progress,
          completedChunks: Math.min(i + maxConcurrency, chunks.length),
          totalChunks: chunks.length,
        });

        // Force garbage collection after each batch
        if (global.gc) {
          global.gc();
        }

        // Small delay to prevent overwhelming the system
        await this.delay(10);
      }

      this.completeProcess(processId);
      return results;
    } catch (error) {
      console.error(`❌ Process ${processId} failed:`, error);
      this.completeProcess(processId);
      throw error;
    }
  }

  /**
   * Create chunks from data array
   * @param {Array} data - Data to chunk
   * @param {number} chunkSize - Size of each chunk
   */
  createChunks(data, chunkSize) {
    const chunks = [];
    for (let i = 0; i < data.length; i += chunkSize) {
      chunks.push(data.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Stream process large datasets
   * @param {Array} data - Data to process
   * @param {Function} processor - Processing function
   * @param {Object} options - Processing options
   */
  async streamProcess(data, processor, options = {}) {
    const {
      chunkSize = 1000,
      processId = `stream_${Date.now()}`,
      onProgress = () => {},
      onChunkComplete = () => {},
    } = options;

    this.registerProcess(processId, {
      totalItems: data.length,
      chunkSize,
      type: 'stream',
    });

    try {
      const results = [];
      let processedItems = 0;

      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        const chunkIndex = Math.floor(i / chunkSize);
        
        const startTime = Date.now();
        const chunkResult = await processor(chunk, chunkIndex);
        const duration = Date.now() - startTime;

        results.push(chunkResult);
        processedItems += chunk.length;

        onChunkComplete({
          chunkIndex,
          chunkSize: chunk.length,
          duration,
          result: chunkResult,
        });

        onProgress({
          processedItems,
          totalItems: data.length,
          progress: (processedItems / data.length) * 100,
          completedChunks: chunkIndex + 1,
          totalChunks: Math.ceil(data.length / chunkSize),
        });

        // Force garbage collection after each chunk
        if (global.gc) {
          global.gc();
        }

        // Small delay to prevent overwhelming the system
        await this.delay(5);
      }

      this.completeProcess(processId);
      return results;
    } catch (error) {
      console.error(`❌ Stream process ${processId} failed:`, error);
      this.completeProcess(processId);
      throw error;
    }
  }

  /**
   * Optimize memory usage for bulk operations
   * @param {Object} sequelize - Sequelize instance
   * @param {Array} data - Data to process
   * @param {Function} processor - Processing function
   */
  async optimizeBulkOperation(sequelize, data, processor) {
    const processId = `bulk_${Date.now()}`;
    
    try {
      // Optimize database connection for bulk operations
      await sequelize.query('SET SESSION bulk_insert_buffer_size = 256*1024*1024');
      await sequelize.query('SET SESSION myisam_sort_buffer_size = 128*1024*1024');
      
      // Process data in chunks
      const results = await this.processInChunks(data, processor, {
        chunkSize: 500,
        processId,
        maxConcurrency: 2, // Limit concurrency for database operations
      });

      return results;
    } finally {
      // Reset database settings
      await sequelize.query('SET SESSION bulk_insert_buffer_size = DEFAULT');
      await sequelize.query('SET SESSION myisam_sort_buffer_size = DEFAULT');
    }
  }

  /**
   * Monitor memory usage
   */
  getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: Math.round(usage.rss / 1024 / 1024), // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
      external: Math.round(usage.external / 1024 / 1024), // MB
      arrayBuffers: Math.round(usage.arrayBuffers / 1024 / 1024), // MB
      activeProcesses: this.activeProcesses.size,
    };
  }

  /**
   * Get active processes
   */
  getActiveProcesses() {
    const processes = [];
    for (const [id, process] of this.activeProcesses.entries()) {
      processes.push({
        id,
        startTime: process.startTime,
        duration: Date.now() - process.startTime,
        completed: process.completed,
        metadata: process.metadata,
      });
    }
    return processes;
  }

  /**
   * Force cleanup of all processes
   */
  forceCleanup() {
    console.log('🧹 Force cleaning up all processes...');
    this.activeProcesses.clear();
    
    // Force garbage collection
    if (global.gc) {
      global.gc();
    }
  }

  /**
   * Delay utility
   * @param {number} ms - Milliseconds to delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup on shutdown
   */
  async shutdown() {
    console.log('🔄 Shutting down memory management service...');
    
    // Complete all active processes
    for (const [id, process] of this.activeProcesses.entries()) {
      if (!process.completed) {
        process.completed = true;
        process.endTime = Date.now();
        process.duration = process.endTime - process.startTime;
        console.log(`✅ Completed process during shutdown: ${id}`);
      }
    }

    // Clear all processes
    this.activeProcesses.clear();
    
    // Force final garbage collection
    if (global.gc) {
      global.gc();
    }

    console.log('✅ Memory management service shutdown complete');
  }
}

export default new MemoryManagementService();
