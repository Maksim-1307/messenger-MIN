export interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  chat_key: string;
  text: string;
  is_read: boolean;
  created_at: string;
}

export interface ChatOtherUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface ChatLastMessage {
  id: string;
  text: string;
  sender_id: string;
  created_at: string;
}

export interface EnrichedChat {
  id: string;
  type: 'private' | 'group' | 'channel';
  last_message_id: string | null;
  updated_at: string;
  participants: string[];
  unreadCount: number;
  lastMessage: ChatLastMessage | null;
  otherUser: ChatOtherUser | null;
}

export interface PaginationInfo {
  limit: number;
  from: string | null;
  to: string | null;
  hasMore: boolean;
}

export interface ChatsResponse {
  message: string;
  chats: EnrichedChat[];
  pagination: PaginationInfo;
}

export interface MessagesResponse {
  message: string;
  messages: Message[];
  pagination: PaginationInfo;
}

export interface SendMessageResponse {
  message: string;
  data: Message;
}
