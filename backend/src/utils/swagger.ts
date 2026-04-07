import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './config.js';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Messenger-MIN API',
      version: '1.0.0',
      description: 'API documentation for Messenger-MIN',
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            username: { type: 'string' },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            token: { type: 'string', description: 'JWT access token' },
            user: { $ref: '#/components/schemas/User' },
          },
        },
        Message: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            sender_id: { type: 'string' },
            recipient_id: { type: 'string' },
            chat_key: { type: 'string' },
            text: { type: 'string' },
            is_read: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        EnrichedChat: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: { type: 'string', enum: ['private', 'group', 'channel'] },
            last_message_id: { type: 'string', nullable: true },
            updated_at: { type: 'string', format: 'date-time' },
            participants: { type: 'array', items: { type: 'string' } },
            unreadCount: { type: 'integer' },
            lastMessage: {
              type: 'object',
              nullable: true,
              properties: {
                id: { type: 'string' },
                text: { type: 'string' },
                sender_id: { type: 'string' },
                created_at: { type: 'string', format: 'date-time' },
              },
            },
            otherUser: {
              type: 'object',
              nullable: true,
              properties: {
                id: { type: 'string' },
                username: { type: 'string' },
                displayName: { type: 'string', nullable: true },
                avatarUrl: { type: 'string', nullable: true },
              },
            },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            limit: { type: 'integer' },
            from: { type: 'string', nullable: true },
            to: { type: 'string', nullable: true },
            hasMore: { type: 'boolean' },
          },
        },
        PublicUserProfile: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            username: { type: 'string' },
            displayName: { type: 'string', nullable: true },
            role: { type: 'string' },
            email: { type: 'string', nullable: true },
            description: { type: 'string', nullable: true },
            avatarUrl: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
      },
    },
  },
  apis: ['./src/routes/docs.ts', './src/controllers/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
