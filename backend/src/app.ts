import express, { type Request, type Response } from 'express';
import { register, login } from './controllers/authController.js';
import { AuthError } from './services/authService.js';

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
      register: 'POST /api/auth/register',
      login: 'POST /api/auth/login',
    },
  });
});

// Auth routes
app.post('/api/auth/register', register);
app.post('/api/auth/login', login);

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

// Error handler
app.use((err: Error, req: Request, res: Response, next: Function) => {
  if (err instanceof AuthError) {
    res.status(err.statusCode).json({ message: err.message });
    return;
  }

  console.error('Unexpected error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

// 404 handler for undefined routes
app.use((req: Request, res: Response) => {
  res.status(404).json({
    message: 'Route not found',
    path: req.originalUrl,
  });
});

export default app;
