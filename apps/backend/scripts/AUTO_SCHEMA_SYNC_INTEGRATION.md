# Auto Schema Sync Integration Guide

This guide shows how to integrate automatic schema synchronization into your application startup process.

## 🚀 Quick Integration

### 1. Add to package.json scripts
```json
{
  "scripts": {
    "start": "node scripts/startup-schema-sync.js && node index.js",
    "dev": "node scripts/startup-schema-sync.js && nodemon index.js",
    "schema-sync": "node scripts/auto-schema-sync.js"
  }
}
```

### 2. Integrate into your main application file
```javascript
// In your main app.js or index.js
import StartupSchemaSync from './scripts/startup-schema-sync.js';

async function startApplication() {
  // Run schema sync first
  const schemaSync = new StartupSchemaSync();
  await schemaSync.run();
  
  // Start your application
  const app = require('./src/app.js');
  const port = process.env.PORT || 3000;
  
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

startApplication().catch(console.error);
```

### 3. Docker Integration
```dockerfile
# In your Dockerfile
COPY scripts/auto-schema-sync.js /app/scripts/
COPY scripts/startup-schema-sync.js /app/scripts/

# Add to your startup command
CMD ["sh", "-c", "node scripts/startup-schema-sync.js && node index.js"]
```

### 4. PM2 Integration
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'fbr-backend',
    script: 'index.js',
    pre_start: 'node scripts/auto-schema-sync.js',
    env: {
      NODE_ENV: 'production',
      AUTO_SCHEMA_SYNC: 'true'
    }
  }]
};
```

## ⚙️ Environment Configuration

Add these environment variables to control the auto sync behavior:

```env
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
```

## 🔧 Integration Examples

### Express.js Application
```javascript
// app.js
import express from 'express';
import StartupSchemaSync from './scripts/startup-schema-sync.js';

const app = express();

async function initializeApp() {
  try {
    // Run schema sync
    const schemaSync = new StartupSchemaSync();
    const result = await schemaSync.run();
    
    if (!result.success && !result.skipped) {
      console.warn('Schema sync had issues, but continuing...');
    }
    
    // Your app initialization code here
    app.use(express.json());
    // ... other middleware and routes
    
    return app;
  } catch (error) {
    console.error('Failed to initialize app:', error);
    process.exit(1);
  }
}

// Start the application
initializeApp().then(app => {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server started on port ${port}`);
  });
});
```

### NestJS Application
```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import StartupSchemaSync from './scripts/startup-schema-sync.js';

async function bootstrap() {
  // Run schema sync before starting the app
  const schemaSync = new StartupSchemaSync();
  await schemaSync.run();
  
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();
```

### Docker Compose
```yaml
# docker-compose.yml
version: '3.8'
services:
  backend:
    build: .
    environment:
      - AUTO_SCHEMA_SYNC=true
      - SCHEMA_SYNC_SILENT=true
      - SCHEMA_SYNC_TIMEOUT=60000
    command: ["sh", "-c", "node scripts/startup-schema-sync.js && node index.js"]
    depends_on:
      - mysql
```

### Kubernetes Deployment
```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fbr-backend
spec:
  template:
    spec:
      containers:
      - name: backend
        image: your-app:latest
        env:
        - name: AUTO_SCHEMA_SYNC
          value: "true"
        - name: SCHEMA_SYNC_SILENT
          value: "true"
        command: ["sh", "-c"]
        args: ["node scripts/startup-schema-sync.js && node index.js"]
```

## 📊 Monitoring and Logging

### Health Check Integration
```javascript
// health-check.js
import AutoSchemaSync from './scripts/auto-schema-sync.js';

export async function healthCheck() {
  try {
    const sync = new AutoSchemaSync();
    const result = await sync.run();
    
    return {
      status: result.success ? 'healthy' : 'degraded',
      schemaSync: {
        success: result.success,
        duration: result.duration,
        tablesCreated: result.results.tablesCreated,
        columnsAdded: result.results.columnsAdded,
        errors: result.results.errors.length,
        warnings: result.results.warnings.length
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
}
```

### Logging Integration
```javascript
// logger.js
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'schema-sync.log' })
  ]
});

// In your schema sync script
logger.info('Schema sync started', { timestamp: new Date().toISOString() });
logger.info('Schema sync completed', { 
  success: result.success, 
  duration: result.duration,
  results: result.results 
});
```

## 🚨 Error Handling

### Graceful Degradation
```javascript
// The auto sync is designed to never crash your application
// If schema sync fails, the application will still start

async function startApp() {
  const schemaSync = new StartupSchemaSync();
  const result = await schemaSync.run();
  
  if (!result.success) {
    // Log the error but continue
    console.error('Schema sync failed:', result.error);
    // Optionally send alert to monitoring system
    // sendAlert('Schema sync failed', result);
  }
  
  // Application continues to start normally
  startServer();
}
```

### Retry Logic
The auto sync includes built-in retry logic:
- Configurable retry attempts (default: 3)
- Configurable retry delay (default: 5 seconds)
- Exponential backoff for database connection issues

## 🔍 Troubleshooting

### Common Issues

1. **Schema sync takes too long**
   - Increase `SCHEMA_SYNC_TIMEOUT`
   - Check database performance
   - Consider running sync in background

2. **Database connection issues**
   - Verify database credentials
   - Check network connectivity
   - Ensure database server is running

3. **Permission errors**
   - Verify database user has CREATE/ALTER permissions
   - Check tenant database access

### Debug Mode
```env
# Enable debug logging
SCHEMA_SYNC_SILENT=false
NODE_ENV=development
```

## 📈 Performance Considerations

- Schema sync runs only once per application startup
- Uses connection pooling for efficiency
- Includes timeout protection to prevent hanging
- Minimal impact on application startup time
- Can be disabled in production if needed

## 🎯 Best Practices

1. **Always test in staging first**
2. **Monitor schema sync logs**
3. **Set appropriate timeouts**
4. **Use silent mode in production**
5. **Have database backups before major deployments**
6. **Consider running sync during maintenance windows for large changes**
