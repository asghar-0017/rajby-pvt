/**
 * Schema Sync Integration Helper
 * 
 * This file provides easy integration functions for your existing application.
 * Simply import and call these functions in your main application file.
 */

import AutoSchemaSync from './auto-schema-sync.js';

/**
 * Run schema sync before starting your application
 * This is the simplest way to integrate auto schema sync
 */
export async function runSchemaSyncOnStartup() {
  console.log('🔄 Running automatic schema synchronization...');
  
  const sync = new AutoSchemaSync();
  const result = await sync.run();
  
  if (result.success) {
    console.log('✅ Schema synchronization completed successfully');
  } else {
    console.warn('⚠️  Schema synchronization had issues, but continuing with startup...');
    if (result.error) {
      console.error('Error:', result.error);
    }
  }
  
  return result;
}

/**
 * Run schema sync with custom configuration
 */
export async function runSchemaSyncWithConfig(options = {}) {
  const sync = new AutoSchemaSync();
  
  // Override default settings
  if (options.silent !== undefined) {
    sync.silent = options.silent;
  }
  if (options.maxRetries !== undefined) {
    sync.maxRetries = options.maxRetries;
  }
  if (options.retryDelay !== undefined) {
    sync.retryDelay = options.retryDelay;
  }
  
  return await sync.run();
}

/**
 * Check if schema sync is enabled via environment variables
 */
export function isSchemaSyncEnabled() {
  return process.env.AUTO_SCHEMA_SYNC !== 'false';
}

/**
 * Get schema sync configuration from environment
 */
export function getSchemaSyncConfig() {
  return {
    enabled: process.env.AUTO_SCHEMA_SYNC !== 'false',
    silent: process.env.SCHEMA_SYNC_SILENT === 'true',
    maxRetries: parseInt(process.env.SCHEMA_SYNC_MAX_RETRIES) || 3,
    retryDelay: parseInt(process.env.SCHEMA_SYNC_RETRY_DELAY) || 5000,
    timeout: parseInt(process.env.SCHEMA_SYNC_TIMEOUT) || 30000
  };
}

/**
 * Example integration for Express.js applications
 */
export function expressIntegration(app) {
  return async function(req, res, next) {
    // This middleware ensures schema sync runs before handling requests
    if (!app.locals.schemaSyncCompleted) {
      try {
        await runSchemaSyncOnStartup();
        app.locals.schemaSyncCompleted = true;
      } catch (error) {
        console.error('Schema sync failed:', error);
        // Continue anyway - don't block requests
      }
    }
    next();
  };
}

/**
 * Example integration for Node.js applications
 */
export async function nodeIntegration() {
  if (isSchemaSyncEnabled()) {
    try {
      await runSchemaSyncOnStartup();
    } catch (error) {
      console.error('Schema sync failed during startup:', error);
      // Don't exit - let the application continue
    }
  }
}

// Default export for easy importing
export default {
  runSchemaSyncOnStartup,
  runSchemaSyncWithConfig,
  isSchemaSyncEnabled,
  getSchemaSyncConfig,
  expressIntegration,
  nodeIntegration
};
