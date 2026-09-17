import { Response, NextFunction } from 'express';
import * as replicationService from './replication.service';
import { AuthenticatedRequest } from '../../types';

export async function getStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const status = await replicationService.getReplicationStatus();
    res.json({ success: true, data: status });
  } catch (err) { next(err); }
}

export async function triggerSync(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    // Run sync in background
    replicationService.syncToReplica().catch(console.error);
    res.json({ success: true, message: 'Replication sync started' });
  } catch (err) { next(err); }
}
