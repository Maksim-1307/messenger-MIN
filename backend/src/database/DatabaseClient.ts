import { Pool, PoolConfig, PoolClient, QueryResult, QueryConfig } from 'pg';
import { config } from '../utils/config.js';

export class DatabaseClient {
  private pool: Pool | null = null;
  private isConnected: boolean = false;

  constructor() {}

  /**
   * Initialize the database connection pool
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      console.log('Database already connected');
      return;
    }

    const poolConfig: PoolConfig = {
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.name,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
      ssl: config.nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
    };

    try {
      this.pool = new Pool(poolConfig);

      // Test the connection
      await this.pool.query('SELECT NOW()');
      
      this.isConnected = true;
      console.log(`Database connected successfully to ${config.db.name} at ${config.db.host}:${config.db.port}`);

      // Handle pool events
      this.pool.on('error', (err: Error) => {
        console.error('Unexpected error on idle client', err);
      });

      this.pool.on('connect', () => {
        console.debug('New client connected to database');
      });

      this.pool.on('remove', () => {
        console.debug('Client removed from pool');
      });
    } catch (error) {
      console.error('Failed to connect to database:', error);
      throw error;
    }
  }

  /**
   * Close the database connection pool
   */
  async disconnect(): Promise<void> {
    if (!this.pool) {
      console.log('No database connection to close');
      return;
    }

    try {
      await this.pool.end();
      this.isConnected = false;
      console.log('Database connection closed');
    } catch (error) {
      console.error('Error closing database connection:', error);
      throw error;
    }
  }

  /**
   * Execute a query
   */
  async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    if (!this.pool || !this.isConnected) {
      throw new Error('Database not connected');
    }

    const start = Date.now();
    try {
      const result = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;
      console.debug('Executed query', { text, duration, rows: result.rowCount });
      return result;
    } catch (error) {
      console.error('Query error:', { text, error });
      throw error;
    }
  }

  /**
   * Execute a query with a transaction
   */
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    if (!this.pool || !this.isConnected) {
      throw new Error('Database not connected');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get a client from the pool for manual transaction management
   */
  async getClient(): Promise<PoolClient> {
    if (!this.pool || !this.isConnected) {
      throw new Error('Database not connected');
    }
    return this.pool.connect();
  }

  /**
   * Check if database is connected
   */
  getConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get pool statistics
   */
  getPoolStats() {
    if (!this.pool) {
      return null;
    }
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }
}

// Export singleton instance
export const db = new DatabaseClient();
