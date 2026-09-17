import { Response, NextFunction } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import * as filesService from './files.service';
import { AuthenticatedRequest } from '../../types';

function validate(req: AuthenticatedRequest, res: Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return false;
  }
  return true;
}

export async function listFiles(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const page = parseInt(String(req.query.page ?? '1'), 10);
    const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10), 100);
    const sort = String(req.query.sort ?? 'createdAt');
    const order = req.query.order === 'asc' ? 'asc' : 'desc';
    const result = await filesService.listFiles(req.user!.id, page, limit, sort, order);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function getUploadUrl(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!validate(req, res)) return;
    const { fileName, filePath, mimeType, sizeBytes } = req.body;
    const result = await filesService.getUploadUrl(req.user!.id, fileName, filePath, mimeType, Number(sizeBytes));
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function confirmUpload(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!validate(req, res)) return;
    const { s3Key, fileName, filePath, mimeType, sizeBytes, checksum } = req.body;
    const result = await filesService.confirmUpload(req.user!.id, s3Key, fileName, filePath, mimeType, Number(sizeBytes), checksum);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function getFile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const result = await filesService.getFile(req.user!.id, req.params.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function updateFile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { fileName, tags } = req.body;
    const file = await filesService.renameFile(req.user!.id, req.params.id, fileName, tags);
    res.json({ success: true, data: file });
  } catch (err) { next(err); }
}

export async function softDeleteFile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    await filesService.softDeleteFile(req.user!.id, req.params.id);
    res.json({ success: true, message: 'File moved to trash' });
  } catch (err) { next(err); }
}

export async function hardDeleteFile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    await filesService.hardDeleteFile(req.user!.id, req.params.id);
    res.json({ success: true, message: 'File permanently deleted' });
  } catch (err) { next(err); }
}

export async function restoreFile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    await filesService.restoreDeletedFile(req.user!.id, req.params.id);
    res.json({ success: true, message: 'File restored' });
  } catch (err) { next(err); }
}

export async function getTrash(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const files = await filesService.getTrash(req.user!.id);
    res.json({ success: true, data: files });
  } catch (err) { next(err); }
}

export async function getStats(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const stats = await filesService.getStorageStats(req.user!.id);
    res.json({ success: true, data: stats });
  } catch (err) { next(err); }
}

export async function batchDownload(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { fileIds } = req.body;
    const urls = await filesService.batchDownloadUrls(req.user!.id, fileIds);
    res.json({ success: true, data: urls });
  } catch (err) { next(err); }
}
