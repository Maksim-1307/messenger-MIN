import type { Request, Response, NextFunction } from 'express';
import { chatRepository } from '../repositories/ChatRepository.js';
import { userRepository } from '../repositories/UserRepository.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * GET /api/chats
 * Return enriched chats for the authenticated user with pagination.
 * Query params:
 *   - limit (default 50, max 200)
 *   - from (cursor: chat id or ISO timestamp)
 *   - to   (cursor: chat id or ISO timestamp)
 */
export const getChats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const numericUserId = parseInt(userId);

    const limit = Math.min(parseInt(req.query.limit as string) || DEFAULT_LIMIT, MAX_LIMIT);
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    const chats = await chatRepository.getUserChatsEnriched(numericUserId, limit, from, to);

    res.status(200).json({
      message: 'Chats fetched successfully',
      chats,
      pagination: {
        limit,
        from: from ?? null,
        to: to ?? null,
        hasMore: chats.length === limit,
      },
    });
  } catch (error) {
    next(error);
  }
};
