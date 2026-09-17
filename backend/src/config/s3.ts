import { S3Client } from '@aws-sdk/client-s3';
import { env } from './env';

// S3 client for backend internal operations (headObject, copyObject, listObjects, delete)
export const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
  ...(env.S3_ENDPOINT
    ? {
        endpoint: env.S3_ENDPOINT,
        forcePathStyle: true,
      }
    : {}),
});

// S3 presigner client for pre-signed URLs intended for direct browser access.
// In Docker, backend connects internally to MinIO (e.g. http://minio:9000),
// but the browser accesses MinIO from the host (http://localhost:9000).
// Because AWS SigV4 includes the Host header in the signature, the presigned URL
// must be signed using the public endpoint.
const publicEndpoint =
  process.env.S3_PUBLIC_ENDPOINT ||
  (env.S3_ENDPOINT?.includes('minio') ? 'http://localhost:9000' : env.S3_ENDPOINT);

export const s3PresignerClient = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
  ...(publicEndpoint
    ? {
        endpoint: publicEndpoint,
        forcePathStyle: true,
      }
    : {}),
});

export const BUCKETS = {
  PRIMARY: env.S3_PRIMARY_BUCKET,
  REPLICA: env.S3_REPLICA_BUCKET,
  BACKUP: env.S3_BACKUP_BUCKET,
} as const;
