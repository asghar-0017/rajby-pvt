/**
 * Example Integration - How to add auto schema sync to your existing application
 * 
 * Choose one of these methods based on your application setup:
 */

// ============================================================================
// METHOD 1: Simple Integration (Recommended)
// ============================================================================

// Add this to the top of your main application file (app.js, index.js, server.js)
import { runSchemaSyncOnStartup } from './scripts/integrate-schema-sync.js';

async function startApplication() {
  // Run schema sync first
  await runSchemaSyncOnStartup();
  
  // Your existing application startup code here
  const app = require('./src/app.js');
  const port = process.env.PORT || 3000;
  
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

startApplication().catch(console.error);

// ============================================================================
// METHOD 2: Express.js Middleware Integration
// ============================================================================

import express from 'express';
import { expressIntegration } from './scripts/integrate-schema-sync.js';

const app = express();

// Add schema sync middleware (runs once on first request)
app.use(expressIntegration(app));

// Your existing middleware and routes
app.use(express.json());
// ... other middleware

app.get('/', (req, res) => {
  res.json({ message: 'Hello World' });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});

// ============================================================================
// METHOD 3: Package.json Scripts Integration
// ============================================================================

// Add to your package.json:
/*
{
  "scripts": {
    "start": "node scripts/startup-schema-sync.js && node index.js",
    "dev": "node scripts/startup-schema-sync.js && nodemon index.js",
    "schema-sync": "node scripts/auto-schema-sync.js"
  }
}
*/

// Then run: npm start or npm run dev

// ============================================================================
// METHOD 4: Docker Integration
// ============================================================================

// In your Dockerfile:
/*
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["sh", "-c", "node scripts/startup-schema-sync.js && node index.js"]
*/

// ============================================================================
// METHOD 5: PM2 Integration
// ============================================================================

// In your ecosystem.config.js:
/*
module.exports = {
  apps: [{
    name: 'fbr-backend',
    script: 'index.js',
    pre_start: 'node scripts/auto-schema-sync.js',
    env: {
      NODE_ENV: 'production',
      AUTO_SCHEMA_SYNC: 'true',
      SCHEMA_SYNC_SILENT: 'true'
    }
  }]
};
*/

// ============================================================================
// METHOD 6: Custom Integration with Error Handling
// ============================================================================

import { runSchemaSyncWithConfig, getSchemaSyncConfig } from './scripts/integrate-schema-sync.js';

async function startApplicationWithCustomSync() {
  const config = getSchemaSyncConfig();
  
  if (config.enabled) {
    console.log('Running schema synchronization...');
    
    try {
      const result = await runSchemaSyncWithConfig({
        silent: config.silent,
        maxRetries: config.maxRetries,
        retryDelay: config.retryDelay
      });
      
      if (result.success) {
        console.log('✅ Schema sync completed successfully');
      } else {
        console.warn('⚠️  Schema sync had issues:', result.error);
        // Log to monitoring system if needed
        // sendToMonitoring('schema_sync_warning', result);
      }
    } catch (error) {
      console.error('❌ Schema sync failed:', error);
      // Don't exit - let application continue
    }
  }
  
  // Start your application
  const app = require('./src/app.js');
  app.listen(process.env.PORT || 3000);
}

startApplicationWithCustomSync().catch(console.error);

// ============================================================================
// ENVIRONMENT VARIABLES TO ADD
// ============================================================================

/*
Add these to your .env file:

# Enable/disable auto schema sync (default: true)
AUTO_SCHEMA_SYNC=true

# Run in silent mode (default: false)
SCHEMA_SYNC_SILENT=false

# Maximum retry attempts (default: 3)
SCHEMA_SYNC_MAX_RETRIES=3

# Delay between retries in ms (default: 5000)
SCHEMA_SYNC_RETRY_DELAY=5000

# Timeout for schema sync in ms (default: 30000)
SCHEMA_SYNC_TIMEOUT=30000
*/

// ============================================================================
// TESTING THE INTEGRATION
// ============================================================================

// To test if the integration works:
// 1. Add the integration code to your app
// 2. Start your application
// 3. Check the console output for schema sync messages
// 4. Verify that missing tables/columns are created in your database

export {
  startApplication,
  startApplicationWithCustomSync
};
