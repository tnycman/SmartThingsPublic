import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

interface Config {
  env: string;
  port: number;
  apiVersion: string;
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    ssl: boolean;
  };
  jwt: {
    secret: string;
    expiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  credit: {
    defaultLimit: number;
    minScore: number;
    maxScore: number;
  };
  payment: {
    retryAttempts: number;
    retryDelayDays: number;
  };
  merchant: {
    defaultFee: number;
  };
  urls: {
    frontend: string;
    merchantDashboard: string;
  };
  logging: {
    level: string;
  };
}

const config: Config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiVersion: process.env.API_VERSION || 'v1',

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'klarna_clone',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: process.env.DB_SSL === 'true',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  credit: {
    defaultLimit: parseInt(process.env.DEFAULT_CREDIT_LIMIT || '5000', 10),
    minScore: parseInt(process.env.MIN_CREDIT_SCORE || '600', 10),
    maxScore: parseInt(process.env.MAX_CREDIT_SCORE || '850', 10),
  },

  payment: {
    retryAttempts: parseInt(process.env.PAYMENT_RETRY_ATTEMPTS || '3', 10),
    retryDelayDays: parseInt(process.env.PAYMENT_RETRY_DELAY_DAYS || '7', 10),
  },

  merchant: {
    defaultFee: parseFloat(process.env.DEFAULT_MERCHANT_FEE || '3.5'),
  },

  urls: {
    frontend: process.env.FRONTEND_URL || 'http://localhost:3001',
    merchantDashboard: process.env.MERCHANT_DASHBOARD_URL || 'http://localhost:3002',
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

export default config;
