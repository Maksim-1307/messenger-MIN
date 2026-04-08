import { useEffect, useRef } from 'react';
import { socketService } from '../services/socketService';
import type { Message } from '../types/chat';

interface UseSocketOptions {
  token: string | null;
  onMessageReceived?: (message: Message) => void;
}

export const useSocket = ({ token, onMessageReceived }: UseSocketOptions) => {
  const onMessageReceivedRef = useRef(onMessageReceived);

  // Keep the ref updated
  useEffect(() => {
    onMessageReceivedRef.current = onMessageReceived;
  }, [onMessageReceived]);

  useEffect(() => {
    if (!token) {
      socketService.disconnect();
      return;
    }

    socketService.connect(token);

    // Subscribe to messages
    const unsubscribe = socketService.onMessage((message) => {
      onMessageReceivedRef.current?.(message);
    });

    return () => {
      unsubscribe();
      socketService.disconnect();
    };
  }, [token]);

  return {
    sendMessage: (recipientId: number, text: string) => socketService.sendMessage(recipientId, text),
    isConnected: socketService.isConnected(),
  };
};

