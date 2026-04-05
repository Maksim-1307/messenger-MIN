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
