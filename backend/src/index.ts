import app from './app.js';
import { config } from './utils/config.js';
import { db, initializeDatabase } from './database/index.js';

async function startServer(): Promise<void> {
  try {
    // 1. Connect to database
    await db.connect();
    
    // 2. Initialize database schema (creates tables if not exist)
    await initializeDatabase();
    
    // 3. Start HTTP server
    app.listen(config.port, () => {
      console.log(`Server is running on port ${config.port}`);
      console.log(`Health check: http://localhost:${config.port}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await db.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await db.disconnect();
  process.exit(0);
});

startServer();

export default app;
