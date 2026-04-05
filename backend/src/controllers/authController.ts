import type { Request, Response, NextFunction } from 'express';
import * as authService from '../services/authService.js';
import { AuthError } from '../services/authService.js';
import { userProfileRepository } from '../repositories/UserProfileRepository.js';
import { getAvatarUrl } from '../middleware/upload.js';

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { username, password } = req.body;

    const result = await authService.register(username, password);

    if (result === 'USER_EXISTS') {
      res.status(409).json({ message: 'User already exists' });
      return;
    }

    // If avatar was uploaded during registration, attach it
    if (req.file) {
      const user = await authService.getUserByUsername(username);
      if (user) {
        const numericUserId = parseInt(user.id);
        const avatarPath = req.file.filename;
        await userProfileRepository.setAvatarPath(numericUserId, avatarPath);
      }
    }

    res.status(201).json({
      message: 'User created successfully',
      avatar: req.file ? getAvatarUrl(req.file.filename) : null,
    });
    return;
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { username, password } = req.body;

    const response = await authService.login(username, password);

    res.json(response);
  } catch (error) {
    next(error);
  }
};
