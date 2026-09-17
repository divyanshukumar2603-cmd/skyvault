import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/cloudvault_test',
      S3_ACCESS_KEY_ID: 'test_access_key',
      S3_SECRET_ACCESS_KEY: 'test_secret_key',
      S3_PRIMARY_BUCKET: 'cloudvault-primary-test',
      S3_REPLICA_BUCKET: 'cloudvault-replica-test',
      S3_BACKUP_BUCKET: 'cloudvault-backups-test',
      JWT_ACCESS_SECRET: 'test_super_secret_access_jwt_key_that_is_long_enough',
      JWT_REFRESH_SECRET: 'test_super_secret_refresh_jwt_key_that_is_long_enough',
    },
  },
});
