import prisma from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { generateDownloadUrl, copyObject, buildS3Key } from '../../utils/s3Operations';
import { BUCKETS } from '../../config/s3';

export async function listVersions(userId: string, fileId: string) {
  const file = await prisma.file.findFirst({ where: { id: fileId, userId } });
  if (!file) throw new AppError(404, 'File not found');

  const versions = await prisma.fileVersion.findMany({
    where: { fileId },
    orderBy: { versionNumber: 'desc' },
  });
  return { file, versions };
}

export async function getVersionDownloadUrl(userId: string, fileId: string, versionId: string) {
  const file = await prisma.file.findFirst({ where: { id: fileId, userId } });
  if (!file) throw new AppError(404, 'File not found');

  const version = await prisma.fileVersion.findFirst({ where: { id: versionId, fileId } });
  if (!version) throw new AppError(404, 'Version not found');

  const downloadUrl = await generateDownloadUrl(version.s3Key);

  await prisma.auditLog.create({
    data: { userId, fileId, action: 'DOWNLOAD', details: { versionNumber: version.versionNumber } },
  });

  return { version, downloadUrl };
}

export async function restoreVersion(userId: string, fileId: string, versionId: string) {
  const file = await prisma.file.findFirst({
    where: { id: fileId, userId, isDeleted: false },
  });
  if (!file) throw new AppError(404, 'File not found');

  const version = await prisma.fileVersion.findFirst({ where: { id: versionId, fileId } });
  if (!version) throw new AppError(404, 'Version not found');

  if (version.versionNumber === file.currentVersion) {
    throw new AppError(400, 'This is already the current version');
  }

  const newVersionNumber = file.currentVersion + 1;
  const newS3Key = buildS3Key(userId, file.filePath, newVersionNumber);

  // Copy the old version's object to a new key
  await copyObject(version.s3Key, newS3Key);

  return prisma.$transaction(async (tx) => {
    const newVersion = await tx.fileVersion.create({
      data: {
        fileId: file.id,
        versionNumber: newVersionNumber,
        s3Key: newS3Key,
        sizeBytes: version.sizeBytes,
        checksum: version.checksum,
      },
    });

    await tx.file.update({
      where: { id: fileId },
      data: { s3Key: newS3Key, currentVersion: newVersionNumber, sizeBytes: version.sizeBytes },
    });

    await tx.auditLog.create({
      data: {
        userId, fileId, action: 'VERSION_RESTORE',
        details: { restoredFrom: version.versionNumber, newVersion: newVersionNumber },
      },
    });

    return { file, restoredVersion: version, newVersion };
  });
}
