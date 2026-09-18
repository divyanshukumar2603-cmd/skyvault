/**
 * Show what is actually stored in the CloudVault S3 buckets.
 *
 *   node scripts/list-s3.js
 *
 * Lists the primary, replica and backup buckets side by side and flags any
 * object present in primary but missing from the replica.
 */
const path = require('path');
const BACKEND = path.resolve(__dirname, '../backend/node_modules');
require(path.join(BACKEND, 'dotenv')).config({ path: path.resolve(__dirname, '../.env') });
const S = require(path.join(BACKEND, '@aws-sdk/client-s3'));

const e = process.env;
const client = new S.S3Client({
  region: e.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: e.S3_ACCESS_KEY_ID,
    secretAccessKey: e.S3_SECRET_ACCESS_KEY,
    ...(e.AWS_SESSION_TOKEN ? { sessionToken: e.AWS_SESSION_TOKEN } : {}),
  },
});

async function listAll(Bucket) {
  const out = [];
  let ContinuationToken;
  do {
    const r = await client.send(new S.ListObjectsV2Command({ Bucket, ContinuationToken }));
    out.push(...(r.Contents || []));
    ContinuationToken = r.NextContinuationToken;
  } while (ContinuationToken);
  return out.sort((a, b) => b.LastModified - a.LastModified);
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`.padStart(10);

(async () => {
  const [primary, replica, backup] = await Promise.all(
    [e.S3_PRIMARY_BUCKET, e.S3_REPLICA_BUCKET, e.S3_BACKUP_BUCKET].map(listAll)
  );

  for (const [label, bucket, objs] of [
    ['PRIMARY', e.S3_PRIMARY_BUCKET, primary],
    ['REPLICA', e.S3_REPLICA_BUCKET, replica],
    ['BACKUP ', e.S3_BACKUP_BUCKET, backup],
  ]) {
    console.log(`\n${label}  ${bucket}  —  ${objs.length} object(s)`);
    objs.slice(0, 25).forEach((o) =>
      console.log(`  ${o.LastModified.toISOString().slice(0, 19)}  ${kb(o.Size)}  ${o.Key}`)
    );
    if (objs.length > 25) console.log(`  … and ${objs.length - 25} more`);
  }

  const replicaKeys = new Set(replica.map((o) => o.Key));
  const missing = primary.filter((o) => !replicaKeys.has(o.Key));
  console.log(`\nReplication: ${primary.length - missing.length}/${primary.length} objects present in replica`);
  if (missing.length) {
    console.log('Not yet replicated (objects uploaded before the replication rule existed):');
    missing.forEach((o) => console.log(`  - ${o.Key}`));
    console.log('Use "Sync now" on the Backups & Replication page to back-fill these.');
  }
})();
