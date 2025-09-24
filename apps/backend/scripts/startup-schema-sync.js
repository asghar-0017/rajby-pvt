#!/usr/bin/env node

/**
 * Startup Schema Synchronization
 * 
 * This script can be integrated into your application startup process.
 * It runs schema checks automatically when the application starts.
 * 
 * Usage:
 * 1. Add to package.json scripts
 * 2. Call from your main application file
 * 3. Use in Docker containers
 * 4. Integrate with PM2 or other process managers
 */

import AutoSchemaSync from './auto-schema-sync.js';
import dotenv from 'dotenv';

dotenv.config();

class StartupSchemaSync {
  constructor() {
    this.sync = new AutoSchemaSync();
    this.enabled = process.env.AUTO_SCHEMA_SYNC !== 'false'; // Default to true
    this.timeout = parseInt(process.env.SCHEMA_SYNC_TIMEOUT) || 30000; // 30 seconds
  }

  async runWithTimeout() {
    if (!this.enabled) {
      console.log('Auto schema sync is disabled');
      return { success: true, skipped: true };
    }

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        console.log('Schema sync timeout reached, continuing with application startup');
        resolve({ success: false, timeout: true });
      }, this.timeout);

      this.sync.run()
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          console.error('Schema sync failed:', error.message);
          resolve({ success: false, error: error.message });
        });
    });
  }

  async run() {
    console.log('🚀 Starting application with auto schema sync...');
    
    const result = await this.runWithTimeout();
    
    if (result.success) {
      console.log('✅ Schema sync completed successfully');
    } else if (result.skipped) {
      console.log('⏭️  Schema sync skipped');
    } else if (result.timeout) {
      console.log('⏰ Schema sync timed out, continuing...');
    } else {
      console.log('⚠️  Schema sync had issues, but continuing with startup...');
    }
    
    return result;
  }
}

// Export for use in other modules
export default StartupSchemaSync;

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const startupSync = new StartupSchemaSync();
  startupSync.run()
    .then(result => {
      if (result.success || result.skipped) {
        process.exit(0);
      } else {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Startup schema sync failed:', error);
      process.exit(1);
    });
}
