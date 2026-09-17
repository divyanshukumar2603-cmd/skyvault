import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, s3PresignerClient, BUCKETS } from '../config/s3';
import { logger } from './logger';

// Generate a pre-signed PUT URL for direct client→S3 upload
export async function generateUploadUrl(
  s3Key: string,
  mimeType: string,
  expiresIn = 900 // 15 minutes
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKETS.PRIMARY,
    Key: s3Key,
    ContentType: mimeType,
  });
  return getSignedUrl(s3PresignerClient, command, { expiresIn });
}

// Generate a pre-signed GET URL for download
export async function generateDownloadUrl(
  s3Key: string,
  bucket = BUCKETS.PRIMARY,
  expiresIn = 3600 // 1 hour
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: s3Key,
  });
  return getSignedUrl(s3PresignerClient, command, { expiresIn });
}

// Check if an object exists and get its metadata
export async function headObject(s3Key: string, bucket = BUCKETS.PRIMARY) {
  const command = new HeadObjectCommand({ Bucket: bucket, Key: s3Key });
  return s3Client.send(command);
}

// Copy an object within or across buckets
export async function copyObject(
  sourceKey: string,
  destinationKey: string,
  sourceBucket = BUCKETS.PRIMARY,
  destinationBucket = BUCKETS.PRIMARY
): Promise<void> {
  const command = new CopyObjectCommand({
    CopySource: `${sourceBucket}/${sourceKey}`,
    Bucket: destinationBucket,
    Key: destinationKey,
  });
  await s3Client.send(command);
}

// Delete a single object
export async function deleteObject(s3Key: string, bucket = BUCKETS.PRIMARY): Promise<void> {
  const command = new DeleteObjectCommand({ Bucket: bucket, Key: s3Key });
  await s3Client.send(command);
}

// Delete multiple objects in one request (max 1000)
export async function deleteObjects(s3Keys: string[], bucket = BUCKETS.PRIMARY): Promise<void> {
  if (s3Keys.length === 0) return;
  const command = new DeleteObjectsCommand({
    Bucket: bucket,
    Delete: {
      Objects: s3Keys.map((Key) => ({ Key })),
      Quiet: true,
    },
  });
  await s3Client.send(command);
}

// List objects under a prefix
export async function listObjects(prefix: string, bucket = BUCKETS.PRIMARY) {
  const objects: { key: string; size: number; lastModified: Date }[] = [];
  let continuationToken: string | undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });
    const response = await s3Client.send(command);
    for (const obj of response.Contents ?? []) {
      if (obj.Key) {
        objects.push({
          key: obj.Key,
          size: obj.Size ?? 0,
          lastModified: obj.LastModified ?? new Date(),
        });
      }
    }
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return objects;
}

// Build the S3 key for a versioned file
export function buildS3Key(userId: string, filePath: string, versionNumber: number): string {
  return `users/${userId}/${filePath}/v${versionNumber}`;
}
