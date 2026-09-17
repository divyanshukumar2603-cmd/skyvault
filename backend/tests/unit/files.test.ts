import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUploadUrl } from '../../src/modules/files/files.service';
import prisma from '../../src/config/db';
import * as s3Ops from '../../src/utils/s3Operations';

vi.mock('../../src/config/db', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
    file: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../src/utils/s3Operations', () => ({
  buildS3Key: vi.fn((userId, filePath, versionNumber) => `users/${userId}/${filePath}/v${versionNumber}`),
  generateUploadUrl: vi.fn(async (key, mime) => `https://s3.amazonaws.com/test-bucket/${key}?signed=true`),
}));

describe('Files Service - Upload URL & Versioning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject file sizes exceeding 5 GB limit', async () => {
    const over5GB = 5368709121; // 5GB + 1 byte
    await expect(
      getUploadUrl('user1', 'bigfile.iso', 'bigfile.iso', 'application/octet-stream', over5GB)
    ).rejects.toThrow(/exceeds the 5 GB size limit/i);
  });

  it('should reject upload if user storage quota is exceeded', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'user1',
      storageUsed: BigInt(9_000_000_000),
      storageQuota: BigInt(10_000_000_000), // 10 GB
    });

    const incomingSize = 1_500_000_000; // 1.5 GB -> 9 + 1.5 > 10
    await expect(
      getUploadUrl('user1', 'large.mp4', 'large.mp4', 'video/mp4', incomingSize)
    ).rejects.toThrow(/quota exceeded/i);
  });

  it('should generate v1 for a brand new file', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'user1',
      storageUsed: BigInt(0),
      storageQuota: BigInt(10_000_000_000),
    });
    (prisma.file.findUnique as any).mockResolvedValue(null);

    const result = await getUploadUrl('user1', 'notes.txt', 'notes.txt', 'text/plain', 1024);

    expect(result.versionNumber).toBe(1);
    expect(result.isNewFile).toBe(true);
    expect(result.s3Key).toBe('users/user1/notes.txt/v1');
    expect(result.uploadUrl).toContain('users/user1/notes.txt/v1');
  });

  it('should generate v2 for an existing file with currentVersion 1', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'user1',
      storageUsed: BigInt(1024),
      storageQuota: BigInt(10_000_000_000),
    });
    (prisma.file.findUnique as any).mockResolvedValue({
      id: 'file_abc',
      currentVersion: 1,
    });

    const result = await getUploadUrl('user1', 'notes.txt', 'notes.txt', 'text/plain', 2048);

    expect(result.versionNumber).toBe(2);
    expect(result.isNewFile).toBe(false);
    expect(result.s3Key).toBe('users/user1/notes.txt/v2');
  });
});
