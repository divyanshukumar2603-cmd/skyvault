import { Router } from 'express';
import { body } from 'express-validator';
import * as filesController from './files.controller';
import { authenticate } from '../../middleware/auth';
import { AuthenticatedRequest } from '../../types';

const router = Router();
router.use(authenticate as any);

const auth = (handler: Function) => (req: any, res: any, next: any) => handler(req as AuthenticatedRequest, res, next);

router.get('/', auth(filesController.listFiles));
router.get('/stats', auth(filesController.getStats));
router.get('/trash', auth(filesController.getTrash));

router.post(
  '/upload-url',
  [
    body('fileName').notEmpty().trim(),
    body('filePath').notEmpty().trim(),
    body('mimeType').notEmpty(),
    body('sizeBytes').isInt({ min: 1 }),
  ],
  auth(filesController.getUploadUrl)
);

router.post(
  '/confirm-upload',
  [
    body('s3Key').notEmpty(),
    body('fileName').notEmpty().trim(),
    body('filePath').notEmpty().trim(),
    body('mimeType').notEmpty(),
    body('sizeBytes').isInt({ min: 1 }),
  ],
  auth(filesController.confirmUpload)
);

router.post('/batch-download', [body('fileIds').isArray({ min: 1 })], auth(filesController.batchDownload));

router.get('/:id', auth(filesController.getFile));
router.patch('/:id', auth(filesController.updateFile));
router.delete('/:id', auth(filesController.softDeleteFile));
router.delete('/:id/hard', auth(filesController.hardDeleteFile));
router.post('/:id/restore', auth(filesController.restoreFile));

export default router;
