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

interface AgentQuestionPayload {
  question: string;
  chatHistory?: Array<{ sender: string; text: string }>;
}

type MessageHandler = (message: Message) => void;
type AgentChunkHandler = (chunk: string) => void;
type AgentErrorHandler = (error: { message: string }) => void;

class SocketService {
  private socket: Socket | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private agentChunkHandlers: Set<AgentChunkHandler> = new Set();
  private agentErrorHandlers: Set<AgentErrorHandler> = new Set();
  private agentFinishHandlers: Set<(() => void)> = new Set();
  private questionChunkHandlers: Set<AgentChunkHandler> = new Set();
  private questionErrorHandlers: Set<AgentErrorHandler> = new Set();
  private questionFinishHandlers: Set<(() => void)> = new Set();
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

    // Agent events
    this.socket.on('agent:partial_response', (data: { textPart: string }) => {
      console.log('Partial response:', data.textPart);
      this.agentChunkHandlers.forEach((handler) => handler(data.textPart));
    });

    this.socket.on('agent:finished', () => {
      this.agentFinishHandlers.forEach((handler) => handler());
    });

    this.socket.on('agent:error', (error: { message: string }) => {
      this.agentErrorHandlers.forEach((handler) => handler(error));
    });

    // Question events (separate from summary events)
    this.socket.on('agent:question_response', (data: { textPart: string }) => {
      this.questionChunkHandlers.forEach((handler) => handler(data.textPart));
    });

    this.socket.on('agent:question_finished', () => {
      this.questionFinishHandlers.forEach((handler) => handler());
    });

    this.socket.on('agent:question_error', (error: { message: string }) => {
      this.questionErrorHandlers.forEach((handler) => handler(error));
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

  // Agent summarization
  requestSummary() {
    if (!this.socket?.connected) {
      console.error('Socket not connected, cannot request summary');
      return;
    }
    this.socket.emit('agent:summarize');
  }

  // Agent question
  askQuestion(question: string, chatHistory?: Array<{ sender: string; text: string }>) {
    if (!this.socket?.connected) {
      console.error('Socket not connected, cannot ask question');
      return;
    }
    const payload: AgentQuestionPayload = { question, chatHistory };
    this.socket.emit('agent:question', payload);
  }

  // Handler registration
  onAgentChunk(handler: AgentChunkHandler): () => void {
    this.agentChunkHandlers.add(handler);
    return () => {
      this.agentChunkHandlers.delete(handler);
    };
  }

  onAgentFinish(handler: () => void): () => void {
    this.agentFinishHandlers.add(handler);
    return () => {
      this.agentFinishHandlers.delete(handler);
    };
  }

  onAgentError(handler: AgentErrorHandler): () => void {
    this.agentErrorHandlers.add(handler);
    return () => {
      this.agentErrorHandlers.delete(handler);
    };
  }

  // Question event handlers
  onQuestionChunk(handler: AgentChunkHandler): () => void {
    this.questionChunkHandlers.add(handler);
    return () => {
      this.questionChunkHandlers.delete(handler);
    };
  }

  onQuestionFinish(handler: () => void): () => void {
    this.questionFinishHandlers.add(handler);
    return () => {
      this.questionFinishHandlers.delete(handler);
    };
  }

  onQuestionError(handler: AgentErrorHandler): () => void {
    this.questionErrorHandlers.add(handler);
    return () => {
      this.questionErrorHandlers.delete(handler);
    };
  }
}

export const socketService = new SocketService();
