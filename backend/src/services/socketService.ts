import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../utils/config.js';
import { messageRepository, buildChatKey } from '../repositories/MessageRepository.js';
import { chatRepository } from '../repositories/ChatRepository.js';
import { userRepository } from '../repositories/UserRepository.js';

interface SocketJWTPayload {
  userId: string;
  username: string;
  userRole: string;
  iat: number;
  exp: number;
}

// Map of userId -> Set of socket IDs
const userSockets = new Map<string, Set<string>>();

interface SendMessagePayload {
  recipientId: number;
  text: string;
}

export class SocketService {
  private io: Server | null = null;

  initialize(server: any): Server {
    this.io = new Server(server, {
      cors: {
        origin: '*', // In production, restrict to frontend origin
        methods: ['GET', 'POST'],
      },
      path: '/ws',
    });

    this.io.use(async (socket: Socket, next) => {
      try {
        const token = socket.handshake.auth.token as string | undefined;

        if (!token) {
          console.error('[Socket] No auth token provided');
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, config.jwt.secret) as SocketJWTPayload;
        console.log('[Socket] JWT verified for user:', decoded.username);

        // Verify user still exists
        const user = await userRepository.findByUsername(decoded.username);
        if (!user) {
          console.error('[Socket] User not found:', decoded.username);
          return next(new Error('User no longer exists'));
        }

        socket.data.userId = decoded.userId;
        socket.data.username = decoded.username;

        next();
      } catch (error) {
        console.error('[Socket] Middleware error:', error);
        if (error instanceof jwt.TokenExpiredError) {
          return next(new Error('Token expired'));
        }
        if (error instanceof jwt.JsonWebTokenError) {
          return next(new Error('Invalid token'));
        }
        next(error as Error);
      }
    });

    this.io.on('connection', (socket: Socket) => {
      const userId = socket.data.userId as string;

      // Register socket for user
      if (!userSockets.has(userId)) {
        userSockets.set(userId, new Set());
      }
      userSockets.get(userId)!.add(socket.id);

      // Join user's personal room
      socket.join(`user:${userId}`);

      console.log(`User ${userId} connected via socket ${socket.id}`);

      // Handle sending messages
      socket.on('send_message', async (data: SendMessagePayload, callback: (response: any) => void) => {
        try {
          const senderId = parseInt(userId);
          const recipientId = data.recipientId;
          const text = data.text?.trim();

          if (!recipientId || recipientId <= 0) {
            return callback({ error: 'Invalid recipient ID' });
          }

          if (!text || text.length === 0) {
            return callback({ error: 'Message text is required' });
          }

          // Verify recipient exists
          const recipient = await userRepository.findById(recipientId);
          if (!recipient) {
            return callback({ error: 'User not found' });
          }

          // Cannot send message to yourself
          if (senderId === recipientId) {
            return callback({ error: 'Cannot send message to yourself' });
          }

          const chatKey = buildChatKey(senderId, recipientId);

          // Ensure a private chat exists (or create one)
          const chat = await chatRepository.getOrCreatePrivateChat(senderId, recipientId);

          // Save message to database
          const message = await messageRepository.create({
            senderId,
            recipientId,
            chatKey,
            text,
          });

          // Emit the message to the recipient's room
          this.io?.to(`user:${recipientId}`).emit('receive_message', {
            ...message,
          });

          // Also emit to sender (for confirmation with the saved message)
          this.io?.to(`user:${userId}`).emit('receive_message', {
            ...message,
          });

          // Update the chat's last_message_id
          await chatRepository.updateLastMessage(parseInt(chat.id), parseInt(message.id));

          callback({ success: true, data: message });
        } catch (error) {
          console.error('Error sending message via socket:', error);
          callback({ error: 'Failed to send message' });
        }
      });

      socket.on('disconnect', () => {
        const sockets = userSockets.get(userId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            userSockets.delete(userId);
          }
        }
        console.log(`User ${userId} disconnected socket ${socket.id}`);
      });
    });

    return this.io;
  }

  getIO(): Server | null {
    return this.io;
  }
}

export const socketService = new SocketService();
