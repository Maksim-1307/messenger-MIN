import type { Request, Response, NextFunction } from 'express';
import { userRepository } from '../repositories/UserRepository.js';
import { userProfileRepository } from '../repositories/UserProfileRepository.js';
import { getAvatarUrl } from '../middleware/upload.js';

/**
 * GET /api/users/:userId — Public user profile
 */
export const getPublicProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const targetUserId = parseInt(req.params.userId);

    if (isNaN(targetUserId) || targetUserId <= 0) {
      res.status(400).json({ message: 'Invalid user ID' });
      return;
    }

    const profile = await userRepository.findPublicProfile(targetUserId);

    if (!profile) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.status(200).json({
      message: 'User profile',
      user: profile,
    });
  } catch (error) {
    next(error);
  }
};

export const updateUserProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const numericUserId = parseInt(userId);
    const { username, displayName, email, description } = req.body;

    // Check if user exists
    const user = await userRepository.findById(numericUserId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // Check if username is being changed and if it's already taken
    if (username && username !== user.username) {
      const existingUser = await userRepository.findByUsername(username);
      if (existingUser) {
        res.status(409).json({ message: 'Username already taken' });
        return;
      }
      await userRepository.updateUsername(numericUserId, username);
    }

    // Update display name if provided
    if (displayName && displayName !== user.displayName) {
      await userRepository.updateDisplayName(numericUserId, displayName);
    }

    // Update profile fields
    const profile = await userProfileRepository.findByUserId(numericUserId);
    const emailChanged = email !== undefined && email !== profile?.email;
    const descriptionChanged = description !== undefined && description !== profile?.description;

    if (profile && (emailChanged || descriptionChanged)) {
      await userProfileRepository.updateProfile(numericUserId, {
        email: email !== undefined ? email : profile.email,
        description: description !== undefined ? description : profile.description,
      });
    }

    // Fetch updated data
    const updatedProfile = await userProfileRepository.findByUserId(numericUserId);
    const updatedUser = await userRepository.findById(numericUserId);

    res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        id: parseInt(updatedUser!.id),
        username: updatedUser!.username,
        displayName: updatedUser!.displayName,
        email: updatedProfile?.email,
        description: updatedProfile?.description,
        avatarUrl: updatedProfile?.avatar_path ? getAvatarUrl(updatedProfile.avatar_path) : null,
        role: updatedUser!.role,
      },
    });
  } catch (error) {
    next(error);
  }
};
