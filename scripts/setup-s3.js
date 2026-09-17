/**
 * One-time AWS S3 setup for CloudVault.
 *
 *   node scripts/setup-s3.js [ec2-public-ip]
 *
 * Applies, using the credentials in .env:
 *   1. versioning on the backup bucket
 *   2. a lifecycle rule archiving backups to Glacier after 90 days
 *   3. a replication rule primary -> replica (via the Learner Lab LabRole)
 *   4. CORS on the primary bucket for localhost and, if given, the EC2 host
 *
 * Safe to re-run: every call is an idempotent Put*.
 */
const path = require('path');
const BACKEND = path.resolve(__dirname, '../backend/node_modules');
require(path.join(BACKEND, 'dotenv')).config({ path: path.resolve(__dirname, '../.env') });
const S = require(path.join(BACKEND, '@aws-sdk/client-s3'));

const e = process.env;
const EC2_HOST = process.argv[2] || null;
const P = e.S3_PRIMARY_BUCKET, R = e.S3_REPLICA_BUCKET, B = e.S3_BACKUP_BUCKET;

// AWS account id is encoded in the access key id — no extra API call or IAM permission needed.
function accountIdFromKey(keyId) {
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const ch of keyId.slice(4, 14).toUpperCase()) {
    bits += ALPHABET.indexOf(ch).toString(2).padStart(5, '0');
  }
  const first48 = BigInt('0b' + bits.slice(0, 48));
  return Number((first48 & 0x7fffffffff80n) >> 7n);
}

const client = new S.S3Client({
  region: e.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: e.S3_ACCESS_KEY_ID,
    secretAccessKey: e.S3_SECRET_ACCESS_KEY,
    ...(e.AWS_SESSION_TOKEN ? { sessionToken: e.AWS_SESSION_TOKEN } : {}),
  },
});

const step = async (label, cmd) => {
  try { await client.send(cmd); console.log(`  ✓ ${label}`); return true; }
  catch (err) { console.log(`  ✗ ${label} — ${err.name}: ${(err.message || '').slice(0, 120)}`); return false; }
};

(async () => {
  const ACCT = accountIdFromKey(e.S3_ACCESS_KEY_ID);
  console.log(`AWS account ${ACCT} · region ${e.AWS_REGION}\n`);

  console.log('1. Backup bucket versioning');
  await step(`versioning on ${B}`, new S.PutBucketVersioningCommand({
    Bucket: B, VersioningConfiguration: { Status: 'Enabled' },
  }));

  console.log('2. Lifecycle: backups -> Glacier after 90 days');
  await step(`lifecycle on ${B}`, new S.PutBucketLifecycleConfigurationCommand({
    Bucket: B, LifecycleConfiguration: { Rules: [{
      ID: 'archive-snapshots-to-glacier', Status: 'Enabled', Filter: { Prefix: '' },
      Transitions: [{ Days: 90, StorageClass: 'GLACIER' }],
      NoncurrentVersionExpiration: { NoncurrentDays: 365 },
      AbortIncompleteMultipartUpload: { DaysAfterInitiation: 7 },
    }] },
  }));

  console.log('3. Replication: primary -> replica');
  let ok = false;
  for (const roleName of ['LabRole', 'S3ReplicationRole']) {
    if (ok) break;
    ok = await step(`rule on ${P} via ${roleName}`, new S.PutBucketReplicationCommand({
      Bucket: P, ReplicationConfiguration: {
        Role: `arn:aws:iam::${ACCT}:role/${roleName}`,
        Rules: [{
          ID: 'replicate-all-to-replica', Status: 'Enabled', Priority: 1,
          Filter: { Prefix: '' }, DeleteMarkerReplication: { Status: 'Enabled' },
          Destination: { Bucket: `arn:aws:s3:::${R}`, StorageClass: 'STANDARD' },
        }],
      },
    }));
  }
  if (!ok) console.log('    (no usable replication role — the app falls back to its own sync loop)');

  console.log('4. CORS on primary');
  const origins = ['http://localhost:3000', 'http://localhost:4000'];
  if (EC2_HOST) origins.push(`http://${EC2_HOST}:3000`, `http://${EC2_HOST}:4000`);
  await step(`cors on ${P} (${origins.length} origins)`, new S.PutBucketCorsCommand({
    Bucket: P, CORSConfiguration: { CORSRules: [{
      AllowedMethods: ['GET', 'PUT', 'POST', 'HEAD', 'DELETE'],
      AllowedOrigins: origins, AllowedHeaders: ['*'],
      ExposeHeaders: ['ETag', 'x-amz-version-id'], MaxAgeSeconds: 3000,
    }] },
  }));

  console.log('\nVerifying:');
  for (const [label, cmd] of [
    ['replication', new S.GetBucketReplicationCommand({ Bucket: P })],
    ['lifecycle  ', new S.GetBucketLifecycleConfigurationCommand({ Bucket: B })],
    ['cors       ', new S.GetBucketCorsCommand({ Bucket: P })],
  ]) {
    try {
      const r = await client.send(cmd);
      const body = r.ReplicationConfiguration?.Rules ?? r.Rules ?? r.CORSRules;
      console.log(`  ${label}:`, JSON.stringify(body).slice(0, 160));
    } catch (err) { console.log(`  ${label}: ${err.name}`); }
  }
})();
