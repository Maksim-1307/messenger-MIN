import { db } from './DatabaseClient.js';

/**
 * Initialize database schema and run migrations
 */
export async function initializeDatabase(): Promise<void> {
  console.log('Initializing database...');

  try {
    // Create users table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        display_name VARCHAR(255),
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'visitor',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Users table initialized');

    // Add role column if it doesn't exist (migration for existing databases)
    await db.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'role'
        ) THEN
          ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'visitor';
        END IF;
      END $$;
    `);
    console.log('Users role column ensured');

    // Migration: remove email column from users table if it exists (belongs in user_profiles)
    await db.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'email'
        ) THEN
          ALTER TABLE users DROP COLUMN email;
        END IF;
      END $$;
    `);
    console.log('Users email column removed (migrated to user_profiles)');

    // Create user_profiles table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email VARCHAR(255) UNIQUE,
        description TEXT,
        avatar_path VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('User profiles table initialized');

    // Add avatar_path column if it doesn't exist
    await db.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'user_profiles' AND column_name = 'avatar_path'
        ) THEN
          ALTER TABLE user_profiles ADD COLUMN avatar_path VARCHAR(500);
        END IF;
      END $$;
    `);
    console.log('User profiles avatar_path column ensured');

    // Make email nullable if it was previously NOT NULL
    await db.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'user_profiles' AND column_name = 'email' AND is_nullable = 'NO'
        ) THEN
          ALTER TABLE user_profiles ALTER COLUMN email DROP NOT NULL;
        END IF;
      END $$;
    `);
    console.log('User profiles email column made nullable');

    // Create index for faster queries
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
      CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
    `);
    console.log('Database indexes created');

    // Create trigger to automatically create user profile when user is created
    await db.query(`
      CREATE OR REPLACE FUNCTION create_user_profile()
      RETURNS TRIGGER AS $$
      BEGIN
        INSERT INTO user_profiles (user_id)
        VALUES (NEW.id);
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await db.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_create_user_profile'
        ) THEN
          CREATE TRIGGER trigger_create_user_profile
          AFTER INSERT ON users
          FOR EACH ROW
          EXECUTE FUNCTION create_user_profile();
        END IF;
      END $$;
    `);
    console.log('Auto-create user profile trigger initialized');

    // Create chats table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS chats (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50) NOT NULL CHECK (type IN ('private', 'group', 'channel')),
        last_message_id INTEGER,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Chats table initialized');

    // Create chat_participants table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS chat_participants (
        chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (chat_id, user_id)
      )
    `);
    console.log('Chat participants table initialized');

    // Create messages table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        chat_key TEXT NOT NULL,
        text TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Messages table initialized');

    // Create indexes for faster queries
    await db.query(`
      -- Messages indexes
      CREATE INDEX IF NOT EXISTS idx_messages_chat_key ON messages(chat_key);
      CREATE INDEX IF NOT EXISTS idx_messages_chat_key_created ON messages (chat_key, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages (sender_id);
      CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON messages (recipient_id);
      CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages (recipient_id) WHERE is_read = FALSE;

      -- Chats indexes
      CREATE INDEX IF NOT EXISTS idx_chats_type ON chats(type);

      -- Chat participants indexes
      CREATE INDEX IF NOT EXISTS idx_chat_participants_user_id ON chat_participants(user_id);
    `);
    console.log('Database indexes created');

    // Backfill: set last_message_id for private chats that have messages but null last_message_id
    // For private chats, chat_key = min(participant1, participant2)_max(participant1, participant2)
    await db.query(`
      UPDATE chats c
      SET last_message_id = (
        SELECT m.id FROM messages m
        WHERE m.chat_key = CONCAT(
          LEAST(p1.user_id, p2.user_id), '_', GREATEST(p1.user_id, p2.user_id)
        )
        ORDER BY m.created_at DESC
        LIMIT 1
      )
      FROM chat_participants p1
      JOIN chat_participants p2 ON p1.chat_id = p2.chat_id AND p1.user_id < p2.user_id
      WHERE c.id = p1.chat_id
        AND c.type = 'private'
        AND c.last_message_id IS NULL
    `);
    console.log('Chat last_message_id backfilled');

    console.log('Database initialization completed');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

/**
 * Check database health
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await db.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}
