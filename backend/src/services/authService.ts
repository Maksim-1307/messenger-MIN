import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db_addUserIf, db_getUserByUsernameIf, db_isAdmin } from '../utils/database.js';
import { config } from '../utils/config.js';
import type { User, JWTPayload, LoginResponse, RegisterResult } from '../types/auth.js';

export class AuthError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

const validateCredentials = (username: string, password: string): void => {
  if (!username || !password) {
    throw new AuthError(400, 'Username and password are required');
  }
  if (username.trim().length === 0 || password.trim().length === 0) {
    throw new AuthError(400, 'Username and password cannot be empty');
  }
};

export const register = async (username: string, password: string): Promise<RegisterResult> => {
  validateCredentials(username, password);
  
  const result = await db_addUserIf(username, password);
  
  if (result !== 'USER_EXISTS' && result !== 'SUCCESS') {
    throw new AuthError(500, 'Unexpected error occurred during registration');
  }
  
  return result;
};

export const login = async (username: string, password: string): Promise<LoginResponse> => {
  validateCredentials(username, password);
  
  const user = await db_getUserByUsernameIf(username);
  
  if (user === 'USER_NOT_FOUND') {
    throw new AuthError(401, 'Invalid credentials');
  }
  
  const isMatch = await bcrypt.compare(password, user.password);
  
  if (!isMatch) {
    throw new AuthError(401, 'Invalid credentials');
  }
  
  const isAdmin = await db_isAdmin(user.id);
  
  const payload: JWTPayload = {
    userId: user.id,
    username: user.username,
    userRole: isAdmin ? 'admin' : 'visitor',
  };
  
  const token = jwt.sign(payload, config.jwt.secret, { expiresIn: '1h' });
  
  return {
    token,
    user: {
      id: user.id,
      username: user.username,
    },
  };
};
