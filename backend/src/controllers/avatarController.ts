import type { Request, Response, NextFunction } from 'express';
import { userProfileRepository } from '../repositories/UserProfileRepository.js';
import { userRepository } from '../repositories/UserRepository.js';
import { deleteAvatarFile, getAvatarUrl } from '../middleware/upload.js';
import path from 'path';
import fs from 'fs';

const AVATARS_DIR = path.resolve(process.cwd(), 'uploads', 'avatars');

/**
 * Handle avatar upload during registration (no auth required, user identified by username)
 */
export const uploadAvatarForRegistration = async (
  username: string,
  file: Express.Multer.File
): Promise<string> => {
  const user = await userRepository.findByUsername(username);
  if (!user) {
    // Shouldn't happen if called after registration
    throw new Error('User not found');
  }

  // Delete old avatar if exists
  const oldPath = await userProfileRepository.getAvatarPath(parseInt(user.id));
  if (oldPath) {
    deleteAvatarFile(oldPath);
  }

  // Save new avatar path (just the filename, not full path)
  const avatarPath = file.filename;
  await userProfileRepository.setAvatarPath(parseInt(user.id), avatarPath);

  return getAvatarUrl(avatarPath)!;
};

/**
 * Upload or replace avatar (authenticated user)
 */
export const uploadAvatar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const numericUserId = parseInt(userId);

    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }

    // Delete old avatar if exists
    const oldPath = await userProfileRepository.getAvatarPath(numericUserId);
    if (oldPath) {
      deleteAvatarFile(oldPath);
    }

    // Save new avatar
    const avatarPath = req.file.filename;
    await userProfileRepository.setAvatarPath(numericUserId, avatarPath);

    res.status(200).json({
      message: 'Avatar uploaded successfully',
      avatar: getAvatarUrl(avatarPath),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove avatar (authenticated user)
 */
export const removeAvatar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const numericUserId = parseInt(userId);

    const oldPath = await userProfileRepository.getAvatarPath(numericUserId);
    await userProfileRepository.removeAvatar(numericUserId);

    if (oldPath) {
      deleteAvatarFile(oldPath);
    }

    res.status(200).json({ message: 'Avatar removed successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Serve avatar file (public endpoint)
 */
export const getAvatar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { filename } = req.params;

    // Security: prevent path traversal
    const safeFilename = path.basename(filename);
    const filePath = path.join(AVATARS_DIR, safeFilename);

    // Verify the resolved path is within AVATARS_DIR
    if (!filePath.startsWith(AVATARS_DIR)) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ message: 'Avatar not found' });
      return;
    }

    // Set content type based on extension
    const ext = path.extname(safeFilename).toLowerCase();
    const contentTypeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
    };

    res.setHeader('Content-Type', contentTypeMap[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24h cache
    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
};
