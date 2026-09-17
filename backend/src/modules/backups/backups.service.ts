import cron from 'node-cron';
import prisma from '../../config/db';
import { BUCKETS } from '../../config/s3';
import { listObjects, copyObject } from '../../utils/s3Operations';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';

let cronJob: cron.ScheduledTask | null = null;
let currentSchedule = '0 0 * * *'; // default: daily midnight UTC

export function startBackupScheduler() {
  if (cronJob) cronJob.stop();
  cronJob = cron.schedule(currentSchedule, () => {
    logger.info('Running scheduled backup...');
    runBackup('SCHEDULED').catch((err) => logger.error('Scheduled backup failed', { err }));
  }, { timezone: 'UTC' });
  logger.info(`Backup scheduler started with schedule: ${currentSchedule}`);
}

export async function runBackup(triggeredBy: 'SCHEDULED' | 'MANUAL') {
  const datePrefix = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const s3Prefix = `backups/${datePrefix}/`;

  const record = await prisma.backupRecord.create({
    data: { bucketName: BUCKETS.BACKUP, s3Prefix, status: 'IN_PROGRESS', triggeredBy },
  });

  let fileCount = 0;
  let totalSize = 0n;
  let failed = false;

  try {
    const objects = await listObjects('users/', BUCKETS.PRIMARY);
    for (const obj of objects) {
      const destKey = `${s3Prefix}${obj.key}`;
      await copyObject(obj.key, destKey, BUCKETS.PRIMARY, BUCKETS.BACKUP);
      fileCount++;
      totalSize += BigInt(obj.size);
    }

    await prisma.backupRecord.update({
      where: { id: record.id },
      data: { status: 'COMPLETED', fileCount, sizeBytes: totalSize, completedAt: new Date() },
    });
    logger.info(`Backup completed: ${fileCount} files, ${totalSize} bytes`);
  } catch (err) {
    failed = true;
    await prisma.backupRecord.update({
      where: { id: record.id },
      data: { status: 'FAILED', errorMsg: String(err), completedAt: new Date() },
    });
    logger.error('Backup failed', { err });
  }

  return { record, fileCount, totalSize: totalSize.toString(), failed };
}

export async function listBackups(page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [records, total] = await Promise.all([
    prisma.backupRecord.findMany({ orderBy: { startedAt: 'desc' }, skip, take: limit }),
    prisma.backupRecord.count(),
  ]);
  return { records, total, page, limit };
}

export async function restoreFromBackup(backupId: string, userId?: string) {
  const backup = await prisma.backupRecord.findUnique({ where: { id: backupId } });
  if (!backup) throw new AppError(404, 'Backup record not found');
  if (backup.status !== 'COMPLETED') throw new AppError(400, 'Backup is not in COMPLETED state');

  const prefix = userId ? `${backup.s3Prefix}users/${userId}/` : backup.s3Prefix;
  const objects = await listObjects(prefix, BUCKETS.BACKUP);

  let restored = 0;
  for (const obj of objects) {
    // Strip the backup prefix to get the original key
    const originalKey = obj.key.replace(backup.s3Prefix, '');
    await copyObject(obj.key, originalKey, BUCKETS.BACKUP, BUCKETS.PRIMARY);
    restored++;
  }

  logger.info(`Restore complete: ${restored} files restored from backup ${backupId}`);
  return { restored };
}

export function getSchedule() {
  return { schedule: currentSchedule, description: 'Daily at midnight UTC' };
}

export function updateSchedule(newSchedule: string) {
  if (!cron.validate(newSchedule)) throw new AppError(400, 'Invalid cron expression');
  currentSchedule = newSchedule;
  startBackupScheduler(); // restart with new schedule
  return { schedule: currentSchedule };
}
