import { api } from '../utils/api';
import type { ChatsResponse, MessagesResponse, SendMessageResponse } from '../types/chat';

export const chatApi = {
  getChats: (token: string, params?: { limit?: number; to?: string }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.to) qs.set('to', params.to);
    const query = qs.toString();
    return api.get<ChatsResponse>(`/api/chats${query ? `?${query}` : ''}`, token);
  },

  getMessages: (token: string, userId: number, params?: { limit?: number; to?: string }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.to) qs.set('to', params.to);
    const query = qs.toString();
    return api.get<MessagesResponse>(`/api/messages/${userId}${query ? `?${query}` : ''}`, token);
  },

  sendMessage: (token: string, userId: number, text: string) => {
    return api.post<SendMessageResponse>(`/api/messages/${userId}`, { text }, token);
  },
};
