import { db } from '../database/DatabaseClient.js';
import { getAvatarUrl } from '../middleware/upload.js';

export type ChatType = 'private' | 'group' | 'channel';

export interface ChatRow {
  id: string;
  type: ChatType;
  last_message_id: string | null;
  updated_at: string;
}

export interface EnrichedChat {
  id: string;
  type: ChatType;
  last_message_id: string | null;
  updated_at: string;
  participants: string[]; // user ids
  unreadCount: number;
  lastMessage: {
    id: string;
    text: string;
    sender_id: string;
    created_at: string;
  } | null;
  // For private chats: the other participant's info
  otherUser: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
}

export interface CreateChatParams {
  type: ChatType;
}

export class ChatRepository {
  /**
   * Create a new chat
   */
  async create(params: CreateChatParams): Promise<ChatRow> {
    const result = await db.query<ChatRow>(
      `INSERT INTO chats (type)
       VALUES ($1)
       RETURNING id::text, type, last_message_id::text, updated_at::text`,
      [params.type]
    );

    return result.rows[0];
  }

  /**
   * Get a chat by ID
   */
  async findById(id: number): Promise<ChatRow | null> {
    const result = await db.query<ChatRow>(
      `SELECT id::text, type, last_message_id::text, updated_at::text
       FROM chats
       WHERE id = $1`,
      [id]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Update the last message ID and timestamp for a chat
   */
  async updateLastMessage(chatId: number, messageId: number): Promise<void> {
    await db.query(
      `UPDATE chats SET last_message_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [messageId, chatId]
    );
  }

  /**
   * Delete a chat by ID
   */
  async deleteById(id: number): Promise<void> {
    await db.query('DELETE FROM chats WHERE id = $1', [id]);
  }

  /**
   * Get all chats of a specific type
   */
  async findByType(type: ChatType): Promise<ChatRow[]> {
    const result = await db.query<ChatRow>(
      `SELECT id::text, type, last_message_id::text, updated_at::text
       FROM chats
       WHERE type = $1
       ORDER BY updated_at DESC`,
      [type]
    );

    return result.rows;
  }

  /**
   * Add a participant to a chat
   */
  async addParticipant(chatId: number, userId: number): Promise<void> {
    await db.query(
      `INSERT INTO chat_participants (chat_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [chatId, userId]
    );
  }

  /**
   * Remove a participant from a chat
   */
  async removeParticipant(chatId: number, userId: number): Promise<void> {
    await db.query(
      'DELETE FROM chat_participants WHERE chat_id = $1 AND user_id = $2',
      [chatId, userId]
    );
  }

  /**
   * Get all participants of a chat
   */
  async getParticipants(chatId: number | string): Promise<{ user_id: string }[]> {
    const result = await db.query<{ user_id: string }>(
      'SELECT user_id::text FROM chat_participants WHERE chat_id = $1',
      [chatId]
    );

    return result.rows;
  }

  /**
   * Get all chats a user participates in, enriched with participants, last message, and unread count
   */
  async getUserChatsEnriched(userId: number | string, limit: number = 50, from?: string, to?: string): Promise<EnrichedChat[]> {
    // Build range conditions for pagination
    const rangeConditions: string[] = [];
    const values: unknown[] = [userId];
    let paramIndex = 2;

    if (from) {
      if (/^\d+$/.test(from)) {
        rangeConditions.push(`c.id >= $${paramIndex}`);
      } else {
        rangeConditions.push(`c.updated_at >= $${paramIndex}::timestamp`);
      }
      values.push(from);
      paramIndex++;
    }

    if (to) {
      if (/^\d+$/.test(to)) {
        rangeConditions.push(`c.id <= $${paramIndex}`);
      } else {
        rangeConditions.push(`c.updated_at <= $${paramIndex}::timestamp`);
      }
      values.push(to);
      paramIndex++;
    }

    values.push(limit);

    const whereExtra = rangeConditions.length > 0 ? ` AND ${rangeConditions.join(' AND ')}` : '';

    // Fetch chats with participants
    const result = await db.query(
      `SELECT
        c.id::text,
        c.type,
        c.last_message_id::text,
        c.updated_at::text,
        (SELECT array_agg(cp2.user_id)::text[] FROM chat_participants cp2 WHERE cp2.chat_id = c.id) as participants
       FROM chats c
       WHERE c.id IN (SELECT chat_id FROM chat_participants WHERE user_id = $1)${whereExtra}
       ORDER BY c.updated_at DESC
       LIMIT $${paramIndex}`,
      values,
    );

    // For each chat, fetch the last message and unread count separately
    const chats: EnrichedChat[] = [];
    for (const row of result.rows) {
      const participants = row.participants || [];

      // Determine the chat_key for this chat
      let chatKey: string | null = null;
      if (participants.length >= 2) {
        const sorted = [...participants].map(Number).sort((a, b) => a - b);
        chatKey = `${sorted[0]}_${sorted[1]}`;
      }

      // Fetch last message for this chat
      let lastMessage: EnrichedChat['lastMessage'] = null;
      let unreadCount = 0;
      if (chatKey) {
        const msgResult = await db.query(
          `SELECT id::text, text, sender_id::text, created_at::text
           FROM messages
           WHERE chat_key = $1
           ORDER BY created_at DESC
           LIMIT 1`,
          [chatKey]
        );
        if (msgResult.rows.length > 0) {
          const m = msgResult.rows[0];
          lastMessage = { id: m.id, text: m.text, sender_id: m.sender_id, created_at: m.created_at };
        }

        // Count unread messages for this user in this chat
        const unreadResult = await db.query(
          `SELECT COUNT(*)::int as cnt
           FROM messages
           WHERE chat_key = $1 AND recipient_id = $2 AND is_read = FALSE`,
          [chatKey, userId]
        );
        unreadCount = unreadResult.rows[0]?.cnt ?? 0;
      }

      const chat: EnrichedChat = {
        id: row.id,
        type: row.type,
        last_message_id: row.last_message_id,
        updated_at: row.updated_at,
        participants,
        unreadCount,
        lastMessage,
        otherUser: null,
      };

      // For private chats, find the other participant
      if (chat.type === 'private' && participants.length === 2) {
        const otherUserId = participants.find((p: string) => p !== String(userId));
        if (otherUserId) {
          const userResult = await db.query(
            `SELECT u.id::text, u.username, u.display_name, up.avatar_path
             FROM users u
             LEFT JOIN user_profiles up ON u.id = up.user_id
             WHERE u.id = $1`,
            [otherUserId]
          );
          if (userResult.rows.length > 0) {
            const u = userResult.rows[0];
            chat.otherUser = {
              id: u.id,
              username: u.username,
              displayName: u.display_name,
              avatarUrl: u.avatar_path ? getAvatarUrl(u.avatar_path) : null,
            };
          }
        }
      }

      chats.push(chat);
    }

    return chats;
  }

  /**
   * Find or create a private chat between two users using chat_key convention
   */
  async findPrivateChatByUsers(user1Id: number, user2Id: number): Promise<ChatRow | null> {
    const chatKey = `${Math.min(user1Id, user2Id)}_${Math.max(user1Id, user2Id)}`;

    // Find a private chat where both users are participants
    const result = await db.query<ChatRow>(
      `SELECT c.id::text, c.type, c.last_message_id::text, c.updated_at::text
       FROM chats c
       INNER JOIN chat_participants cp1 ON c.id = cp1.chat_id AND cp1.user_id = $1
       INNER JOIN chat_participants cp2 ON c.id = cp2.chat_id AND cp2.user_id = $2
       WHERE c.type = 'private'`,
      [user1Id, user2Id]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Create a private chat between two users
   */
  async createPrivateChat(user1Id: number, user2Id: number): Promise<ChatRow> {
    const chat = await this.create({ type: 'private' });
    await this.addParticipant(parseInt(chat.id), user1Id);
    await this.addParticipant(parseInt(chat.id), user2Id);
    return chat;
  }

  /**
   * Get or create a private chat between two users
   */
  async getOrCreatePrivateChat(user1Id: number, user2Id: number): Promise<ChatRow> {
    let chat = await this.findPrivateChatByUsers(user1Id, user2Id);
    if (!chat) {
      chat = await this.createPrivateChat(user1Id, user2Id);
    }
    return chat;
  }

  /**
   * Check if a user is a participant of a chat
   */
  async isParticipant(chatId: number, userId: number): Promise<boolean> {
    const result = await db.query(
      'SELECT 1 FROM chat_participants WHERE chat_id = $1 AND user_id = $2',
      [chatId, userId]
    );

    return result.rows.length > 0;
  }
}

// Singleton instance
export const chatRepository = new ChatRepository();
