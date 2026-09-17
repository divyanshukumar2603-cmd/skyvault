import { s3Client, BUCKETS } from '../../config/s3';
import { env } from '../../config/env';
import { listObjects, copyObject } from '../../utils/s3Operations';
import { HeadObjectCommand, GetBucketReplicationCommand } from '@aws-sdk/client-s3';
import { logger } from '../../utils/logger';

let lastSyncTime: Date | null = null;
let syncInProgress = false;

const NATIVE_CHECK_TTL_MS = 5 * 60 * 1000;
let nativeRulesCache: { rules: string[] | null; checkedAt: number } | null = null;

// Returns the enabled native S3 replication rule IDs on the primary bucket,
// or null when none are configured (MinIO, or an AWS bucket without a rule).
export async function getNativeReplicationRules(force = false): Promise<string[] | null> {
  if (env.S3_ENDPOINT) return null; // MinIO has no native replication
  if (!force && nativeRulesCache && Date.now() - nativeRulesCache.checkedAt < NATIVE_CHECK_TTL_MS) {
    return nativeRulesCache.rules;
  }

  let rules: string[] | null = null;
  try {
    const res = await s3Client.send(new GetBucketReplicationCommand({ Bucket: BUCKETS.PRIMARY }));
    const enabled = (res.ReplicationConfiguration?.Rules ?? [])
      .filter((r) => r.Status === 'Enabled')
      .map((r) => r.ID ?? 'unnamed');
    rules = enabled.length > 0 ? enabled : null;
  } catch (err) {
    // ReplicationConfigurationNotFoundError (or no permission) => treat as not configured
    rules = null;
  }

  nativeRulesCache = { rules, checkedAt: Date.now() };
  return rules;
}

export async function getReplicationStatus() {
  const nativeRules = await getNativeReplicationRules();
  const mode = env.S3_ENDPOINT
    ? 'simulation (MinIO)'
    : nativeRules
      ? 'native S3 replication'
      : 'application-level sync (AWS)';

  return {
    lastSyncTime: lastSyncTime?.toISOString() ?? null,
    syncInProgress,
    primaryBucket: BUCKETS.PRIMARY,
    replicaBucket: BUCKETS.REPLICA,
    mode,
    nativeRules,
  };
}

// Copies objects from primary to replica that are missing or outdated.
// Used for MinIO locally, and on AWS whenever no native replication rule is configured.
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
