import { Response, NextFunction } from 'express';
import * as backupsService from './backups.service';
import { AuthenticatedRequest } from '../../types';

export async function listBackups(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const page = parseInt(String(req.query.page ?? '1'), 10);
    const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10), 100);
    const result = await backupsService.listBackups(page, limit);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function triggerBackup(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    backupsService.runBackup('MANUAL').catch(console.error); // run async
    res.json({ success: true, message: 'Backup started in background' });
  } catch (err) { next(err); }
}

export async function restoreBackup(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const result = await backupsService.restoreFromBackup(req.params.id, req.user!.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function getSchedule(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: backupsService.getSchedule() });
  } catch (err) { next(err); }
}

export async function updateSchedule(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const result = backupsService.updateSchedule(req.body.schedule);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}
