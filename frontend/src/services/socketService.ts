import { io, Socket } from 'socket.io-client';
import type { Message } from '../types/chat';
import { config } from '../utils/config';

interface SocketResponse<T = unknown> {
  success?: boolean;
  error?: string;
  data?: T;
}

interface SendMessagePayload {
  recipientId: number;
  text: string;
}

type MessageHandler = (message: Message) => void;

class SocketService {
  private socket: Socket | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect(token: string) {
    if (this.socket?.connected) {
      console.log('Socket already connected');
      return;
    }

    console.log('Connecting to socket: ', config.socketUrl);

    // Parse origin and path from config.socketUrl
    const parsed = new URL(config.socketUrl, window.location.href);
    this.socket = io(parsed.origin, {
      auth: { token },
      path: parsed.pathname,  // e.g. '/api-url/ws' -> requests go to '/api-url/ws/socket.io/'
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionDelay: this.reconnectDelay,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('Socket connection error:', error.message);
      this.reconnectAttempts++;
    });

    this.socket.on('receive_message', (message: Message) => {
      console.log(`Received message from ${message.sender_id}:`, message);
      this.messageHandlers.forEach((handler) => handler(message));
      console.log('Message handlers:', this.messageHandlers);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  sendMessage(recipientId: number, text: string): Promise<Message> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      const payload: SendMessagePayload = { recipientId, text };

      this.socket.emit('send_message', payload, (response: SocketResponse<Message>) => {
        if (response.error) {
          reject(new Error(response.error));
        } else if (response.data) {
          resolve(response.data);
        } else {
          reject(new Error('Failed to send message'));
        }
      });
    });
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  getSocket(): Socket | null {
    return this.socket;
  }
}

export const socketService = new SocketService();
