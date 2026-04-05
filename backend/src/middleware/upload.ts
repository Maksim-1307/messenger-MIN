import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const AVATARS_DIR = path.resolve(process.cwd(), 'uploads', 'avatars');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];

// Ensure avatars directory exists
fs.mkdirSync(AVATARS_DIR, { recursive: true, mode: 0o755 });

// Generate a unique filename
const generateFilename = (originalname: string): string => {
  const ext = path.extname(originalname).toLowerCase();
  const hash = crypto.randomBytes(16).toString('hex');
  return `${hash}${ext}`;
};

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, AVATARS_DIR);
  },
  filename: (_req, file, cb) => {
    cb(null, generateFilename(file.originalname));
  },
});

// File filter: validate type
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WebP, and SVG are allowed'));
    return;
  }

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    cb(new Error('Invalid file extension'));
    return;
  }

  cb(null, true);
};

// Multer instance for avatar uploads
export const avatarUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

/**
 * Middleware to set file permissions after upload (non-executable)
 */
export const setFilePermissions = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.file) {
    try {
      fs.chmodSync(req.file.path, 0o644); // rw-r--r--
    } catch (error) {
      console.error('Failed to set file permissions:', error);
    }
  }
  next();
};

/**
 * Delete an avatar file by its path
 */
export const deleteAvatarFile = (avatarPath: string): void => {
  const fullPath = path.resolve(process.cwd(), 'uploads', 'avatars', avatarPath);

  try {
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (error) {
    console.error(`Failed to delete avatar file: ${fullPath}`, error);
  }
};

/**
 * Get the public URL for an avatar
 */
export const getAvatarUrl = (avatarPath: string | null): string | null => {
  if (!avatarPath) return null;
  return `/api/public/avatars/${avatarPath}`;
};
