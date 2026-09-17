import dotenv from 'dotenv';
import path from 'path';
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, defaultValue = ''): string {
  return process.env[key] ?? defaultValue;
}

export const env = {
  NODE_ENV: optional('NODE_ENV', 'development'),
  PORT: parseInt(optional('PORT', '4000'), 10),
  DATABASE_URL: required('DATABASE_URL'),

  // Storage
  S3_ENDPOINT: optional('S3_ENDPOINT'),        // set for MinIO, empty for AWS
  S3_ACCESS_KEY_ID: required('S3_ACCESS_KEY_ID'),
  S3_SECRET_ACCESS_KEY: required('S3_SECRET_ACCESS_KEY'),
  AWS_SESSION_TOKEN: optional('AWS_SESSION_TOKEN'),
  AWS_REGION: optional('AWS_REGION', 'us-east-1'),
  S3_PRIMARY_BUCKET: required('S3_PRIMARY_BUCKET'),
  S3_REPLICA_BUCKET: required('S3_REPLICA_BUCKET'),
  S3_BACKUP_BUCKET: required('S3_BACKUP_BUCKET'),
  S3_REPLICA_REGION: optional('S3_REPLICA_REGION', 'us-west-2'),

  // Auth
  JWT_ACCESS_SECRET: required('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: required('JWT_REFRESH_SECRET'),
  JWT_ACCESS_EXPIRY: optional('JWT_ACCESS_EXPIRY', '15m'),
  JWT_REFRESH_EXPIRY: optional('JWT_REFRESH_EXPIRY', '7d'),

  // OAuth (optional — features degrade gracefully without them)
  GOOGLE_CLIENT_ID: optional('GOOGLE_CLIENT_ID'),
  GOOGLE_CLIENT_SECRET: optional('GOOGLE_CLIENT_SECRET'),
  GITHUB_CLIENT_ID: optional('GITHUB_CLIENT_ID'),
  GITHUB_CLIENT_SECRET: optional('GITHUB_CLIENT_SECRET'),
  OAUTH_CALLBACK_URL: optional('OAUTH_CALLBACK_URL', 'http://localhost:4000/api/auth'),

  // App
  FRONTEND_URL: optional('FRONTEND_URL', 'http://localhost:3000'),

  // Upload limits
  MAX_FILE_SIZE_BYTES: parseInt(optional('MAX_FILE_SIZE_BYTES', '5368709120'), 10), // 5 GB
  MULTIPART_THRESHOLD_BYTES: parseInt(optional('MULTIPART_THRESHOLD_BYTES', '104857600'), 10), // 100 MB
} as const;

export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
