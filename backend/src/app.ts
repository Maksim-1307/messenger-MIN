import express, { type Request, type Response } from 'express';

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Welcome route
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    message: 'Welcome to Messenger-MIN API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      users: 'GET /api/users',
      echo: 'POST /api/echo',
    },
  });
});

// Test route: echo request body
app.post('/api/echo', (req: Request, res: Response) => {
  res.status(200).json({
    message: 'Echo successful',
    received: req.body,
    timestamp: new Date().toISOString(),
  });
});

// Test route: get users (mock data)
app.get('/api/users', (req: Request, res: Response) => {
  const users = [
    { id: 1, username: 'alice', email: 'alice@example.com' },
    { id: 2, username: 'bob', email: 'bob@example.com' },
    { id: 3, username: 'charlie', email: 'charlie@example.com' },
  ];

  res.status(200).json({
    message: 'Users retrieved successfully',
    count: users.length,
    data: users,
  });
});

// 404 handler for undefined routes
app.use((req: Request, res: Response) => {
  res.status(404).json({
    message: 'Route not found',
    path: req.originalUrl,
  });
});

export default app;
