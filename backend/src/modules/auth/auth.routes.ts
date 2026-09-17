import { Router } from 'express';
import passport from 'passport';
import { body } from 'express-validator';
import * as authController from './auth.controller';
import { authenticate } from '../../middleware/auth';
import { authLimiter, oauthLimiter } from '../../middleware/rateLimiter';
import { AuthenticatedRequest } from '../../types';

const router = Router();

// ─── Email / Password ─────────────────────────────────────────────
router.post('/register', authLimiter, authController.registerValidation, authController.register);
router.post(
  '/login',
  authLimiter,
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  authController.login
);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', authenticate as any, (req: any, res: any, next: any) =>
  authController.me(req as AuthenticatedRequest, res, next)
);

// ─── Google OAuth ────────────────────────────────────────────────
router.get(
  '/google',
  oauthLimiter,
  passport.authenticate('google', { session: false, scope: ['profile', 'email'] })
);
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login?error=google_failed' }),
  authController.oauthCallback
);

// ─── GitHub OAuth ────────────────────────────────────────────────
router.get(
  '/github',
  oauthLimiter,
  passport.authenticate('github', { session: false, scope: ['user:email'] })
);
router.get(
  '/github/callback',
  passport.authenticate('github', { session: false, failureRedirect: '/login?error=github_failed' }),
  authController.oauthCallback
);

export default router;
