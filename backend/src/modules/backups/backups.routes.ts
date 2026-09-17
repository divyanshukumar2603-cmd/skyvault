import { Router } from 'express';
import { body } from 'express-validator';
import * as backupsController from './backups.controller';
import { authenticate } from '../../middleware/auth';
import { AuthenticatedRequest } from '../../types';

const router = Router();
router.use(authenticate as any);

const auth = (handler: Function) => (req: any, res: any, next: any) => handler(req as AuthenticatedRequest, res, next);

router.get('/', auth(backupsController.listBackups));
router.post('/trigger', auth(backupsController.triggerBackup));
router.get('/schedule', auth(backupsController.getSchedule));
router.put('/schedule', [body('schedule').notEmpty()], auth(backupsController.updateSchedule));
router.post('/:id/restore', auth(backupsController.restoreBackup));

export default router;
