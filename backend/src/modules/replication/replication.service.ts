import { s3Client, BUCKETS } from '../../config/s3';
import { env } from '../../config/env';
import { listObjects, copyObject } from '../../utils/s3Operations';
import { HeadObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '../../utils/logger';

let lastSyncTime: Date | null = null;
let syncInProgress = false;

export async function getReplicationStatus() {
  return {
    lastSyncTime: lastSyncTime?.toISOString() ?? null,
    syncInProgress,
    primaryBucket: BUCKETS.PRIMARY,
    replicaBucket: BUCKETS.REPLICA,
    mode: env.S3_ENDPOINT ? 'simulation (MinIO)' : 'native S3 CRR',
  };
}

// For local MinIO: copy all objects from primary to replica that are missing or outdated
export async function syncToReplica(): Promise<{ synced: number; errors: number }> {
  if (syncInProgress) return { synced: 0, errors: 0 };
  syncInProgress = true;
  let synced = 0;
  let errors = 0;

  try {
    logger.info('Starting replication sync...');
    const primaryObjects = await listObjects('', BUCKETS.PRIMARY);

    for (const obj of primaryObjects) {
      try {
        // Check if object already exists in replica
        const headCmd = new HeadObjectCommand({ Bucket: BUCKETS.REPLICA, Key: obj.key });
        let needsCopy = false;
        try {
          const head = await s3Client.send(headCmd);
          // Copy if sizes differ (content changed)
          if (head.ContentLength !== obj.size) needsCopy = true;
        } catch {
          needsCopy = true; // Object doesn't exist in replica
        }

        if (needsCopy) {
          await copyObject(obj.key, obj.key, BUCKETS.PRIMARY, BUCKETS.REPLICA);
          synced++;
        }
      } catch (err) {
        logger.error('Failed to replicate object', { key: obj.key, error: err });
        errors++;
      }
    }

    lastSyncTime = new Date();
    logger.info(`Replication sync complete: ${synced} synced, ${errors} errors`);
  } finally {
    syncInProgress = false;
  }

  return { synced, errors };
}
