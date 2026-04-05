import type { Request, Response, NextFunction } from 'express';
import { AuthError } from '../services/authService.js';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('Error:', err);
  
  if (err instanceof AuthError) {
    res.status(err.statusCode).json({ message: err.message });
    return;
  }
  
  res.status(500).json({ message: 'Server error' });
};
