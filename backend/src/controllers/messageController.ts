import type { Request, Response, NextFunction } from 'express';
import { messageRepository, buildChatKey } from '../repositories/MessageRepository.js';
import { chatRepository } from '../repositories/ChatRepository.js';
import { userRepository } from '../repositories/UserRepository.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * GET /api/messages/:userId
 * Return messages between the authenticated user and the target user.
 * Query params:
 *   - limit (default 50, max 200)
 *   - from  (cursor: message id or ISO timestamp)
 *   - to    (cursor: message id or ISO timestamp)
 */
export const getMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUserId = parseInt(req.user!.userId);
    const targetUserId = parseInt(req.params.userId);

    if (isNaN(targetUserId) || targetUserId <= 0) {
      res.status(400).json({ message: 'Invalid user ID' });
      return;
    }

    // Verify the target user exists
    const targetUser = await userRepository.findById(targetUserId);
    if (!targetUser) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const limit = Math.min(parseInt(req.query.limit as string) || DEFAULT_LIMIT, MAX_LIMIT);
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    const messages = await messageRepository.getMessagesBetweenUsers(
      currentUserId,
      targetUserId,
      limit,
      from,
      to,
    );

    res.status(200).json({
      message: 'Messages fetched successfully',
      messages,
      pagination: {
        limit,
        from: from ?? null,
        to: to ?? null,
        hasMore: messages.length === limit,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/messages/:userId
 * Send a new message to the target user.
 * Body: { text: string }
 */
export const sendMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const senderId = parseInt(req.user!.userId);
    const recipientId = parseInt(req.params.userId);
    const { text } = req.body;

    if (isNaN(recipientId) || recipientId <= 0) {
      res.status(400).json({ message: 'Invalid user ID' });
      return;
    }

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      res.status(400).json({ message: 'Message text is required' });
      return;
    }

    // Verify recipient exists
    const recipient = await userRepository.findById(recipientId);
    if (!recipient) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // Cannot send message to yourself
    if (senderId === recipientId) {
      res.status(400).json({ message: 'Cannot send message to yourself' });
      return;
    }

    const chatKey = buildChatKey(senderId, recipientId);

    // Ensure a private chat exists (or create one)
    await chatRepository.getOrCreatePrivateChat(senderId, recipientId);

    const message = await messageRepository.create({
      senderId,
      recipientId,
      chatKey,
      text: text.trim(),
    });

    res.status(201).json({
      message: 'Message sent successfully',
      message,
    });
  } catch (error) {
    next(error);
  }
};
