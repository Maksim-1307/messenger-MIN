import express, { type Request, type Response } from 'express';
import cors from 'cors';
import { register, login } from './controllers/authController.js';
import { AuthError } from './services/authService.js';
import { authenticate, requireAdmin } from './middleware/auth.js';
import { avatarUpload, setFilePermissions, getAvatarUrl } from './middleware/upload.js';
import { uploadAvatar, removeAvatar, getAvatar } from './controllers/avatarController.js';
import { updateUserProfile, getPublicProfile, getPublicProfileByUsername } from './controllers/userController.js';
import { getChats } from './controllers/chatController.js';
import { getMessages, sendMessage } from './controllers/messageController.js';
import { userRepository } from './repositories/UserRepository.js';
import { userProfileRepository } from './repositories/UserProfileRepository.js';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './utils/swagger.js';
import { router as notificationsRouter } from './routes/notifications.js';

const app = express();

// Middleware
app.use(cors()); // Allow all origins
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
      me: 'GET /api/users/me (requires auth)',
      admin: 'GET /api/admin/stats (requires admin)',
      uploadAvatar: 'POST /api/users/avatar (requires auth)',
      removeAvatar: 'DELETE /api/users/avatar (requires auth)',
      getAvatar: 'GET /api/public/avatars/:filename (public)',
    },
  });
});

// Auth routes (public)
app.post('/api/auth/register', avatarUpload.single('avatar'), setFilePermissions, register);
app.post('/api/auth/login', login);

// Avatar routes
app.post('/api/users/avatar', authenticate, avatarUpload.single('avatar'), setFilePermissions, uploadAvatar);
app.delete('/api/users/avatar', authenticate, removeAvatar);

// Public: serve avatars
app.get('/api/public/avatars/:filename', getAvatar);

// Protected routes (requires valid JWT)
app.get('/api/users/me', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const numericUserId = parseInt(userId);
    
    const user = await userRepository.findById(numericUserId);
    const profile = await userProfileRepository.findByUserId(numericUserId);

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.status(200).json({
      message: 'Current user',
      user: {
        id: parseInt(user.id),
        username: user.username,
        displayName: user.displayName,
        email: profile?.email,
        description: profile?.description,
        avatarUrl: profile?.avatar_path ? getAvatarUrl(profile.avatar_path) : null,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Failed to fetch user profile' });
  }
});

// Public: user profile
app.get('/api/users/:userId', getPublicProfile);
app.get('/api/find/:username', getPublicProfileByUsername);

app.put('/api/users/me', authenticate, updateUserProfile);

// Chat routes (requires valid JWT)
app.get('/api/chats', authenticate, getChats);

// Message routes (requires valid JWT)
app.get('/api/messages/:userId', authenticate, getMessages);
app.post('/api/messages/:userId', authenticate, sendMessage);

// Admin-only routes
app.get('/api/admin/stats', authenticate, requireAdmin, (req: Request, res: Response) => {
  res.status(200).json({
    message: 'Admin stats',
    stats: {
      serverUptime: process.uptime(),
      nodeVersion: process.version,
      memoryUsage: process.memoryUsage(),
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

// Notifications routes
app.use('/api/notifications', notificationsRouter);

// Swagger documentation
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Error handler
app.use((err: Error, req: Request, res: Response, next: Function) => {
  if (err.message === 'Unexpected field' || err.message?.includes('file size') || err.message?.includes('Invalid file')) {
    res.status(400).json({ message: err.message });
    return;
  }
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
