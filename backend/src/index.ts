import 'dotenv/config';

// Serialize BigInt fields (storageUsed, sizeBytes, etc.) in JSON responses
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import passport from 'passport';

import { env } from './config/env';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';
import { configurePassport } from './modules/auth/passport.config';
import { startBackupScheduler } from './modules/backups/backups.service';
import { syncToReplica, getNativeReplicationRules } from './modules/replication/replication.service';
import cron from 'node-cron';

import authRoutes from './modules/auth/auth.routes';
import filesRoutes from './modules/files/files.routes';
import versionsRoutes from './modules/versions/versions.routes';
import replicationRoutes from './modules/replication/replication.routes';
import backupsRoutes from './modules/backups/backups.routes';

const app = express();

// ─── Security & Parsing ─────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ─── Passport ───────────────────────────────────────────────────
configurePassport();
app.use(passport.initialize());

// ─── Rate Limiting ──────────────────────────────────────────────
app.use('/api', apiLimiter);

// ─── Health Check ───────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ─── API Routes ─────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/files/:id/versions', versionsRoutes);
app.use('/api/replication', replicationRoutes);
app.use('/api/backups', backupsRoutes);

// ─── 404 Handler ────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ success: false, error: 'Route not found' }));

// ─── Global Error Handler ───────────────────────────────────────
app.use(errorHandler as any);

// ─── Start Server ───────────────────────────────────────────────
app.listen(env.PORT, () => {
  logger.info(`CloudVault API running on port ${env.PORT} [${env.NODE_ENV}]`);
  logger.info(`Storage: ${env.S3_ENDPOINT ? `MinIO @ ${env.S3_ENDPOINT}` : 'AWS S3'}`);

  // Start background schedulers
  startBackupScheduler();

  // Replication: prefer native S3 replication when the bucket has a rule,
  // otherwise run the application-level sync every 5 minutes (MinIO and AWS alike).
  void (async () => {
    const nativeRules = await getNativeReplicationRules(true);
    if (nativeRules) {
      logger.info(`Native S3 replication active on ${env.S3_PRIMARY_BUCKET}: ${nativeRules.join(', ')}`);
      return;
    }
    cron.schedule('*/5 * * * *', () => {
      syncToReplica().catch((err) => logger.error('Replication sync error', { err }));
    });
    logger.info(
      env.S3_ENDPOINT
        ? 'MinIO replication sync scheduled every 5 minutes'
        : 'No native S3 replication rule found — application-level sync scheduled every 5 minutes'
    );
  })();
});

export default app;
