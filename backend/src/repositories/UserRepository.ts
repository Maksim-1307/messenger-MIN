import { db } from '../database/DatabaseClient.js';
import bcrypt from 'bcryptjs';

export interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  role: string;
}

export type RegisterResult = 'USER_EXISTS' | 'SUCCESS';

export class UserRepository {
  private readonly saltRounds = 10;

  /**
   * Find user by username
   */
  async findByUsername(username: string): Promise<UserRow | null> {
    const result = await db.query<UserRow>(
      'SELECT id::text, username, password_hash, role FROM users WHERE username = $1',
      [username]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Create a new user (only if username doesn't exist)
   */
  async createIfNotExists(username: string, password: string): Promise<RegisterResult> {
    const existing = await this.findByUsername(username);
    if (existing) {
      return 'USER_EXISTS';
    }

    const passwordHash = await bcrypt.hash(password, this.saltRounds);

    await db.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2)',
      [username, passwordHash]
    );

    return 'SUCCESS';
  }

  /**
   * Verify password against stored hash
   */
  async verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}

// Singleton instance
export const userRepository = new UserRepository();
