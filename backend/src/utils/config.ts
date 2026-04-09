import dotenv from 'dotenv';

dotenv.config();

const getEnv = (key: string, defaultValue?: string): string => {
  const value = process.env[key];
  if (!value) {
    if (defaultValue !== undefined) {
      console.warn(`Warning: ${key} is not defined, setting to default: ${defaultValue}`);
      return defaultValue;
    }
    console.warn(`Warning: ${key} is not defined`);
    return '';
  }
  return value;
};

const getEnvNumber = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  if (!value) {
    console.warn(`Warning: ${key} is not defined, setting to default: ${defaultValue}`);
    return defaultValue;
  }
  return parseInt(value, 10);
};

export const config = {
  // Server
  port: getEnvNumber('BACKEND_PORT', getEnvNumber('PORT', 3000)),
  nodeEnv: getEnv('NODE_ENV', 'development'),

  // Database
  db: {
    host: getEnv('DB_HOST', 'localhost'),
    port: getEnvNumber('DB_PORT', getEnvNumber('POSTGRES_PORT', 5432)),
    user: getEnv('DB_USER', getEnv('POSTGRES_USER', 'postgres')),
    password: getEnv('DB_PASSWORD', getEnv('POSTGRES_PASSWORD', 'postgres')),
    name: getEnv('DB_NAME', getEnv('POSTGRES_DB', 'messenger')),
  },

  // Redis
  redis: {
    host: getEnv('REDIS_HOST', 'localhost'),
    port: getEnvNumber('REDIS_PORT', 6379),
  },

  // JWT
  jwt: {
    secret: getEnv('JWT_SECRET', 'your-super-secret-jwt-key-change-in-production'),
  },

  // LLM (OpenRouter)
  llm: {
    apiKey: getEnv('LLM_API_KEY', ''),
    model: getEnv('LLM_MODEL', 'google/gemini-2.0-flash-001'),
  },

  // URLs (for frontend communication)
  apiUrl: getEnv('API_URL', 'http://localhost:3000'),
  socketUrl: getEnv('SOCKET_URL', 'http://localhost:3000/ws'),
} as const;

// Validate required environment variables
if (!config.jwt.secret) {
  console.error('ERROR: JWT_SECRET is not defined in environment variables');
  process.exit(1);
}

if (config.nodeEnv === 'production' && config.jwt.secret === 'your-super-secret-jwt-key-change-in-production') {
  throw new Error('JWT_SECRET must be changed in production environment');
}
