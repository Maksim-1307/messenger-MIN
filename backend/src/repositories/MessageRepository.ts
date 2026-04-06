import { db } from '../database/DatabaseClient.js';

export interface MessageRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  chat_key: string;
  text: string;
  is_read: boolean;
  created_at: string;
}

export interface CreateMessageParams {
  senderId: number;
  recipientId: number;
  chatKey: string;
  text: string;
}

export interface MessagesRangeParams {
  chatKey: string;
  from?: string;  // created_at ISO string or message id
  to?: string;    // created_at ISO string or message id
  limit: number;
}

/**
 * Build a deterministic chat_key from two user IDs
 */
export function buildChatKey(userId1: number, userId2: number): string {
  const min = Math.min(userId1, userId2);
  const max = Math.max(userId1, userId2);
  return `${min}_${max}`;
}

export class MessageRepository {
  /**
   * Create a new message
   */
  async create(params: CreateMessageParams): Promise<MessageRow> {
    const result = await db.query<MessageRow>(
      `INSERT INTO messages (sender_id, recipient_id, chat_key, text)
       VALUES ($1, $2, $3, $4)
       RETURNING id::text, sender_id::text, recipient_id::text, chat_key, text, is_read, created_at::text`,
      [params.senderId, params.recipientId, params.chatKey, params.text]
    );

    return result.rows[0];
  }

  /**
   * Get messages between the current user and another user, with range-based pagination.
   * By default returns the most recent messages (last `limit` items).
   * If `from`/`to` cursors are provided, returns messages within that range.
   */
  async getMessagesBetweenUsers(
    userId1: number,
    userId2: number,
    limit: number = 50,
    from?: string,
    to?: string,
  ): Promise<MessageRow[]> {
    const chatKey = buildChatKey(userId1, userId2);

    const conditions: string[] = ['chat_key = $1'];
    const values: unknown[] = [chatKey];
    let paramIndex = 2;

    if (from) {
      // Try to parse as number (id) or treat as timestamp
      if (/^\d+$/.test(from)) {
        conditions.push(`id >= $${paramIndex}`);
      } else {
        conditions.push(`created_at >= $${paramIndex}::timestamp`);
      }
      values.push(from);
      paramIndex++;
    }

    if (to) {
      if (/^\d+$/.test(to)) {
        conditions.push(`id <= $${paramIndex}`);
      } else {
        conditions.push(`created_at <= $${paramIndex}::timestamp`);
      }
      values.push(to);
      paramIndex++;
    }

    values.push(limit);

    const whereClause = conditions.join(' AND ');
    const result = await db.query<MessageRow>(
      `SELECT id::text, sender_id::text, recipient_id::text, chat_key, text, is_read, created_at::text
       FROM messages
       WHERE ${whereClause}
       ORDER BY created_at DESC, id DESC
       LIMIT $${paramIndex}`,
      values,
    );

    return result.rows.reverse();
  }
}

// Singleton instance
export const messageRepository = new MessageRepository();
