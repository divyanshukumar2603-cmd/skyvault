import { describe, it, expect } from 'vitest';
import { buildS3Key } from '../../src/utils/s3Operations';

describe('S3 Utilities', () => {
  it('should construct correct S3 versioned key', () => {
    const key = buildS3Key('usr_999', 'documents/report.pdf', 1);
    expect(key).toBe('users/usr_999/documents/report.pdf/v1');
  });

  it('should handle version increments in key structure', () => {
    const v2Key = buildS3Key('usr_999', 'data.csv', 2);
    expect(v2Key).toBe('users/usr_999/data.csv/v2');

    const v10Key = buildS3Key('usr_999', 'data.csv', 10);
    expect(v10Key).toBe('users/usr_999/data.csv/v10');
  });
});
