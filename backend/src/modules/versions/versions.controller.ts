import { Response, NextFunction } from 'express';
import * as versionsService from './versions.service';
import { AuthenticatedRequest } from '../../types';

export async function listVersions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const result = await versionsService.listVersions(req.user!.id, req.params.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function getVersionUrl(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const result = await versionsService.getVersionDownloadUrl(req.user!.id, req.params.id, req.params.versionId);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function restoreVersion(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const result = await versionsService.restoreVersion(req.user!.id, req.params.id, req.params.versionId);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}
