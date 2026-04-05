import jwt from 'jsonwebtoken';
import { userRepository } from '../repositories/UserRepository.js';
import { config } from '../utils/config.js';
import type { JWTPayload, LoginResponse, RegisterResult } from '../types/auth.js';

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

export const getUserByUsername = async (username: string) => {
  return userRepository.findByUsername(username);
};

export const register = async (username: string, password: string): Promise<RegisterResult> => {
  validateCredentials(username, password);

  const result = await userRepository.createIfNotExists(username, password);

  if (result === 'USER_EXISTS') {
    throw new AuthError(409, 'User already exists');
  }

  return result;
};

export const login = async (username: string, password: string): Promise<LoginResponse> => {
  validateCredentials(username, password);

  const user = await userRepository.findByUsername(username);

  if (!user) {
    throw new AuthError(401, 'Invalid credentials');
  }

  const isMatch = await userRepository.verifyPassword(password, user.password_hash);

  if (!isMatch) {
    throw new AuthError(401, 'Invalid credentials');
  }

  const payload: JWTPayload = {
    userId: user.id,
    username: user.username,
    userRole: user.role === 'admin' ? 'admin' : 'visitor',
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
