import { db } from '../database/DatabaseClient.js';
import bcrypt from 'bcryptjs';
import { getAvatarUrl } from '../middleware/upload.js';

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
  async createIfNotExists(username: string, password: string, displayName?: string): Promise<RegisterResult> {
    const existing = await this.findByUsername(username);
    if (existing) {
      return 'USER_EXISTS';
    }

    const passwordHash = await bcrypt.hash(password, this.saltRounds);

    await db.query(
      'INSERT INTO users (username, password_hash, display_name) VALUES ($1, $2, $3)',
      [username, passwordHash, displayName || null]
    );

    return 'SUCCESS';
  }

  /**
   * Verify password against stored hash
   */
  async verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  /**
   * Find user by ID
   */
  async findById(id: number): Promise<UserRow & { displayName: string | null } | null> {
    const result = await db.query<UserRow & { display_name: string | null }>(
      'SELECT id::text, username, password_hash, role, display_name FROM users WHERE id = $1',
      [id]
    );

    return result.rows.length > 0 ? {
      ...result.rows[0],
      displayName: result.rows[0].display_name,
    } : null;
  }

  /**
   * Update username
   */
  async updateUsername(id: number, newUsername: string): Promise<void> {
    await db.query(
      'UPDATE users SET username = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newUsername, id]
    );
  }

  /**
   * Update display name
   */
  async updateDisplayName(id: number, displayName: string): Promise<void> {
    await db.query(
      'UPDATE users SET display_name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [displayName, id]
    );
  }

  /**
   * Get public user profile by username (no sensitive fields)
   */
  async findPublicProfileByUsername(username: string): Promise<{
    id: string;
    username: string;
    displayName: string | null;
    role: string;
    email: string | null;
    description: string | null;
    avatarUrl: string | null;
    createdAt: string;
  } | null> {
    const result = await db.query(
      `SELECT
        u.id::text,
        u.username,
        u.display_name,
        u.role,
        up.email,
        up.description,
        up.avatar_path,
        up.created_at::text
       FROM users u
       LEFT JOIN user_profiles up ON u.id = up.user_id
       WHERE u.username = $1`,
      [username]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      role: row.role,
      email: row.email,
      description: row.description,
      avatarUrl: row.avatar_path ? getAvatarUrl(row.avatar_path) : null,
      createdAt: row.created_at,
    };
  }

  /**
   * Get public user profile (no sensitive fields)
   */
  async findPublicProfile(id: number): Promise<{
    id: string;
    username: string;
    displayName: string | null;
    role: string;
    email: string | null;
    description: string | null;
    avatarUrl: string | null;
    createdAt: string;
  } | null> {
    const result = await db.query(
      `SELECT
        u.id::text,
        u.username,
        u.display_name,
        u.role,
        up.email,
        up.description,
        up.avatar_path,
        up.created_at::text
       FROM users u
       LEFT JOIN user_profiles up ON u.id = up.user_id
       WHERE u.id = $1`,
      [id]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      role: row.role,
      email: row.email,
      description: row.description,
      avatarUrl: row.avatar_path ? getAvatarUrl(row.avatar_path) : null,
      createdAt: row.created_at,
    };
  }
}

// Singleton instance
export const userRepository = new UserRepository();
