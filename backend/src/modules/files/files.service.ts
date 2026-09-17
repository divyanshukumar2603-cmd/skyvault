import prisma from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { buildS3Key, generateUploadUrl, generateDownloadUrl, headObject, deleteObjects, listObjects, copyObject } from '../../utils/s3Operations';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { BUCKETS } from '../../config/s3';

export async function getUploadUrl(
  userId: string,
  fileName: string,
  filePath: string,
  mimeType: string,
  sizeBytes: number
) {
  // Enforce 5 GB file size cap
  if (sizeBytes > env.MAX_FILE_SIZE_BYTES) {
    throw new AppError(413, `File exceeds the 5 GB size limit`);
  }

  // Check storage quota
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'User not found');
  if (BigInt(user.storageUsed) + BigInt(sizeBytes) > BigInt(user.storageQuota)) {
    throw new AppError(507, 'Storage quota exceeded');
  }

  // Check if file already exists → determine version number
  const existingFile = await prisma.file.findUnique({
    where: { userId_filePath: { userId, filePath } },
  });
  const versionNumber = existingFile ? existingFile.currentVersion + 1 : 1;
  const s3Key = buildS3Key(userId, filePath, versionNumber);
  const uploadUrl = await generateUploadUrl(s3Key, mimeType);

  return { uploadUrl, s3Key, versionNumber, isNewFile: !existingFile };
}

export async function confirmUpload(
  userId: string,
  s3Key: string,
  fileName: string,
  filePath: string,
  mimeType: string,
  sizeBytes: number,
  checksum?: string
) {
  // Verify the object actually exists in S3
  try {
    await headObject(s3Key);
  } catch {
    throw new AppError(400, 'Upload verification failed — object not found in storage');
  }

  const versionMatch = s3Key.match(/\/v(\d+)$/);
  const versionNumber = versionMatch ? parseInt(versionMatch[1], 10) : 1;

  return prisma.$transaction(async (tx) => {
    // Upsert the File record
    const file = await tx.file.upsert({
      where: { userId_filePath: { userId, filePath } },
      create: {
        userId,
        fileName,
        filePath,
        s3Key,
        mimeType,
        sizeBytes: BigInt(sizeBytes),
        currentVersion: versionNumber,
        tags: {},
      },
      update: {
        s3Key,
        fileName,
        mimeType,
        sizeBytes: BigInt(sizeBytes),
        currentVersion: versionNumber,
        isDeleted: false,
        deletedAt: null,
      },
    });

    // Create FileVersion record
    await tx.fileVersion.create({
      data: {
        fileId: file.id,
        versionNumber,
        s3Key,
        sizeBytes: BigInt(sizeBytes),
        checksum: checksum ?? null,
      },
    });

    // Update user storage used
    await tx.user.update({
      where: { id: userId },
      data: { storageUsed: { increment: BigInt(sizeBytes) } },
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        userId,
        fileId: file.id,
        action: versionNumber === 1 ? 'UPLOAD' : 'VERSION_UPLOAD',
        details: { versionNumber, s3Key, sizeBytes },
      },
    });

    return { file, versionNumber };
  });
}

export async function listFiles(
  userId: string,
  page: number,
  limit: number,
  sort: string,
  order: 'asc' | 'desc'
) {
  const skip = (page - 1) * limit;
  const validSortFields = ['fileName', 'createdAt', 'updatedAt', 'sizeBytes'];
  const sortField = validSortFields.includes(sort) ? sort : 'createdAt';

  const [files, total] = await Promise.all([
    prisma.file.findMany({
      where: { userId, isDeleted: false },
      orderBy: { [sortField]: order },
      skip,
      take: limit,
      select: {
        id: true, fileName: true, filePath: true, mimeType: true,
        sizeBytes: true, currentVersion: true, tags: true, createdAt: true, updatedAt: true,
      },
    }),
    prisma.file.count({ where: { userId, isDeleted: false } }),
  ]);

  return { files, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getFile(userId: string, fileId: string) {
  const file = await prisma.file.findFirst({
    where: { id: fileId, userId, isDeleted: false },
  });
  if (!file) throw new AppError(404, 'File not found');

  const downloadUrl = await generateDownloadUrl(file.s3Key);
  return { file, downloadUrl };
}

export async function renameFile(userId: string, fileId: string, newFileName: string, tags?: Record<string, string>) {
  const file = await prisma.file.findFirst({ where: { id: fileId, userId, isDeleted: false } });
  if (!file) throw new AppError(404, 'File not found');

  const updated = await prisma.file.update({
    where: { id: fileId },
    data: {
      ...(newFileName && { fileName: newFileName }),
      ...(tags !== undefined && { tags }),
    },
  });

  await prisma.auditLog.create({
    data: { userId, fileId, action: 'RENAME', details: { newFileName, tags } },
  });

  return updated;
}

export async function softDeleteFile(userId: string, fileId: string) {
  const file = await prisma.file.findFirst({ where: { id: fileId, userId, isDeleted: false } });
  if (!file) throw new AppError(404, 'File not found');

  await prisma.file.update({
    where: { id: fileId },
    data: { isDeleted: true, deletedAt: new Date() },
  });

  await prisma.auditLog.create({ data: { userId, fileId, action: 'DELETE' } });
}

export async function restoreDeletedFile(userId: string, fileId: string) {
  const file = await prisma.file.findFirst({ where: { id: fileId, userId, isDeleted: true } });
  if (!file) throw new AppError(404, 'Deleted file not found');

  await prisma.file.update({
    where: { id: fileId },
    data: { isDeleted: false, deletedAt: null },
  });

  await prisma.auditLog.create({ data: { userId, fileId, action: 'RESTORE' } });
}

export async function hardDeleteFile(userId: string, fileId: string) {
  const file = await prisma.file.findFirst({
    where: { id: fileId, userId },
    include: { versions: true },
  });
  if (!file) throw new AppError(404, 'File not found');

  // Delete all version objects from S3
  const s3Keys = file.versions.map((v) => v.s3Key);
  await deleteObjects(s3Keys);

  // Update storage used
  const totalSize = file.versions.reduce((acc, v) => acc + BigInt(v.sizeBytes), 0n);
  await prisma.user.update({
    where: { id: userId },
    data: { storageUsed: { decrement: totalSize } },
  });

  await prisma.file.delete({ where: { id: fileId } });
  logger.info('Hard deleted file', { fileId, userId, versionsDeleted: s3Keys.length });
}

export async function getTrash(userId: string) {
  return prisma.file.findMany({
    where: { userId, isDeleted: true },
    orderBy: { deletedAt: 'desc' },
    select: { id: true, fileName: true, filePath: true, mimeType: true, sizeBytes: true, deletedAt: true },
  });
}

export async function getStorageStats(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'User not found');

  const fileCount = await prisma.file.count({ where: { userId, isDeleted: false } });

  return {
    storageUsed: user.storageUsed.toString(),
    storageQuota: user.storageQuota.toString(),
    storageUsedPercent: Number((BigInt(user.storageUsed) * 100n) / BigInt(user.storageQuota)),
    fileCount,
  };
}

export async function batchDownloadUrls(userId: string, fileIds: string[]) {
  const files = await prisma.file.findMany({
    where: { id: { in: fileIds }, userId, isDeleted: false },
  });
  const urls = await Promise.all(
    files.map(async (f) => ({
      fileId: f.id,
      fileName: f.fileName,
      downloadUrl: await generateDownloadUrl(f.s3Key),
    }))
  );
  return urls;
}
